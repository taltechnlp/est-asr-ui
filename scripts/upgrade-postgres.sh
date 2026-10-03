#!/usr/bin/env bash
# Major-version upgrade of the Postgres container by dump & restore.
#
#   scripts/upgrade-postgres.sh preflight   read-only checks
#   scripts/upgrade-postgres.sh rehearse    dump the live DB, restore it into a throwaway
#                                           container of the new version and verify it
#   scripts/upgrade-postgres.sh cutover     replace the container (stop the app first)
#   scripts/upgrade-postgres.sh rollback    put the old version back on the old volume
#
# The target version is whatever docker-compose.yml says. The new container gets a
# new volume; the old volume is never written to or removed, so rollback is just
# starting the old image on it again.
#
# Credentials, database name and port are taken from DATABASE_URL (.env), so the
# app keeps connecting with an unchanged connection string.
#
# Environment: BACKUP_DIR (default ./backups), SERVICE (default postgres),
# OLD_CONTAINER (default: the compose service's current container).
set -euo pipefail
umask 077 # the dumps contain everything, password hashes included
cd "$(dirname "$0")/.."

BACKUP_DIR=${BACKUP_DIR:-backups}
SERVICE=${SERVICE:-postgres}
STATE="$BACKUP_DIR/pg-upgrade.state"
OLD_DATA_DIR=/var/lib/postgresql/data
REHEARSAL=pg-upgrade-rehearsal
ROLLBACK=pg-upgrade-rollback

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "==> $*"; }
urldecode() { printf '%b' "${1//%/\\x}"; }

load_database_url() {
	local url=${DATABASE_URL:-}
	[ -n "$url" ] || url=$(sed -nE "s/^DATABASE_URL=[\"']?([^\"']+)[\"']?.*/\1/p" .env 2>/dev/null | tail -1)
	[[ $url =~ ^postgres(ql)?://([^:@]+):([^@]+)@[^:/]+(:([0-9]+))?/([^?]+) ]] ||
		die "cannot parse DATABASE_URL (looked in the environment and .env)"
	DB_USER=$(urldecode "${BASH_REMATCH[2]}")
	DB_PASS=$(urldecode "${BASH_REMATCH[3]}")
	DB_PORT=${BASH_REMATCH[5]:-5432}
	DB_NAME=${BASH_REMATCH[6]}
}

# First value of a key in the resolved compose config
compose_value() { docker compose config | awk -v k="$1:" '$1 == k { gsub(/"/, "", $2); print $2; exit }'; }

sql() { docker exec "$1" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -At -c "$2"; }

# Exact row count of every table, one "schema.table<TAB>count" line each. Sorted
# bytewise: the database collation orders differently on the old and new image.
counts() {
	sql "$1" "select table_schema || '.' || table_name || E'\t' ||
		(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
		from information_schema.tables
		where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')
		order by (table_schema::text || '.' || table_name::text) collate \"C\""
}

wait_ready() {
	# -h 127.0.0.1: the image's init-time server only listens on the socket, so this
	# does not report ready until the real server is up
	local i
	for i in $(seq 60); do
		docker exec "$1" pg_isready -q -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" 2>/dev/null && return
		sleep 1
	done
	die "$1 did not become ready; see: docker logs $1"
}

# Dump with the new version's pg_dump, as recommended for major upgrades
dump() {
	PGPASSWORD=$DB_PASS docker run --rm --network "container:$OLD" -e PGPASSWORD "$NEW_IMAGE" \
		pg_dump -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -Fc >"$1"
	[ -s "$1" ] || die "dump is empty"
	log "dump: $1 ($(du -h "$1" | cut -f1))"
}

restore() {
	docker exec -i "$1" pg_restore -U "$DB_USER" -d "$DB_NAME" \
		--no-owner --no-acl --single-transaction --exit-on-error <"$2"
	sql "$1" 'analyze' >/dev/null
}

verify_counts() {
	local new_counts=${1%.old}.new
	counts "$2" >"$new_counts"
	diff "$1" "$new_counts" || return 1
	log "row counts match: $(wc -l <"$new_counts") tables, $(awk -F'\t' '{ s += $2 } END { print s + 0 }' "$new_counts") rows"
}

preflight() {
	load_database_url
	mkdir -p "$BACKUP_DIR"

	OLD=${OLD_CONTAINER:-$(docker compose ps -aq "$SERVICE" | head -1)}
	[ -n "$OLD" ] || die "no container found for compose service '$SERVICE' (set OLD_CONTAINER)"
	[ "$(docker inspect -f '{{.State.Running}}' "$OLD")" = true ] || die "container $OLD is not running"
	OLD_NAME=$(docker inspect -f '{{.Name}}' "$OLD" | cut -c2-)
	OLD_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$OLD")
	OLD_VOLUME=$(docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$OLD_DATA_DIR\"}}{{if .Name}}{{.Name}}{{else}}{{.Source}}{{end}}{{end}}{{end}}" "$OLD")
	OLD_PORT=$(docker inspect -f '{{with index .HostConfig.PortBindings "5432/tcp"}}{{(index . 0).HostIp}}:{{(index . 0).HostPort}}{{end}}' "$OLD")
	OLD_PORT=${OLD_PORT#:}
	OLD_MAJOR=$(($(sql "$OLD" 'show server_version_num') / 10000))

	NEW_IMAGE=$(compose_value image)
	docker image inspect "$NEW_IMAGE" >/dev/null 2>&1 || docker pull -q "$NEW_IMAGE" >/dev/null
	NEW_MAJOR=$(docker run --rm "$NEW_IMAGE" printenv PG_MAJOR)

	echo "old: $OLD_NAME ($OLD_IMAGE, server $(sql "$OLD" 'show server_version'))"
	echo "     data volume $OLD_VOLUME, port ${OLD_PORT:-<none published>}"
	echo "     database $DB_NAME: $(sql "$OLD" 'select pg_size_pretty(pg_database_size(current_database()))')," \
		"$(sql "$OLD" 'select count(*) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()') open connection(s)"
	echo "new: $NEW_IMAGE ($(docker run --rm "$NEW_IMAGE" printenv PG_VERSION))"
	echo "free space: $(df -h --output=avail "$BACKUP_DIR" | tail -1 | tr -d ' ') in $BACKUP_DIR," \
		"$(docker run --rm -v /var/lib/docker:/d:ro "$NEW_IMAGE" df -h --output=avail /d 2>/dev/null | tail -1 | tr -d ' ') in the docker root"

	[ "$OLD_MAJOR" -lt "$NEW_MAJOR" ] || die "server is already on major $OLD_MAJOR; nothing to upgrade to $NEW_MAJOR"
	[ -n "$OLD_VOLUME" ] || die "$OLD_NAME has nothing mounted at $OLD_DATA_DIR; its data would not survive being replaced"

	# The new container is created from docker-compose.yml, the app connects with
	# DATABASE_URL: they have to agree or the app is locked out after the cutover.
	local c_user c_pass c_db c_port
	c_user=$(compose_value POSTGRES_USER)
	c_pass=$(compose_value POSTGRES_PASSWORD)
	c_db=$(compose_value POSTGRES_DB)
	c_port=$(compose_value published)
	[ "$c_user" = "$DB_USER" ] || die "docker-compose.yml POSTGRES_USER ($c_user) differs from the DATABASE_URL user ($DB_USER)"
	[ "$c_pass" = "$DB_PASS" ] || die "docker-compose.yml POSTGRES_PASSWORD differs from the DATABASE_URL password"
	[ "${c_db:-$c_user}" = "$DB_NAME" ] || die "docker-compose.yml creates database '${c_db:-$c_user}' but DATABASE_URL uses '$DB_NAME'"
	[ "$c_port" = "$DB_PORT" ] || die "docker-compose.yml publishes port $c_port but DATABASE_URL uses $DB_PORT"

	# Only $DB_NAME is carried over; say so if there is anything else
	local extra
	extra=$(sql "$OLD" "select string_agg(datname, ', ') from pg_database where not datistemplate and datname not in ('postgres', current_database())")
	[ -z "$extra" ] || echo "WARNING: other databases will NOT be migrated: $extra"
	extra=$(sql "$OLD" "select string_agg(rolname, ', ') from pg_roles where rolname !~ '^pg_' and rolname not in ('postgres', current_user)")
	[ -z "$extra" ] || echo "WARNING: other roles will NOT be migrated (everything will be owned by $DB_USER): $extra"
	extra=$(sql "$OLD" "select string_agg(extname, ', ') from pg_extension where extname <> 'plpgsql'")
	[ -z "$extra" ] || echo "WARNING: extensions in use, check they exist in $NEW_IMAGE: $extra"
}

cmd_rehearse() {
	preflight
	local ts dumpfile port
	ts=$(date +%Y%m%d-%H%M%S)
	dumpfile="$BACKUP_DIR/$DB_NAME-pg$OLD_MAJOR-$ts-rehearsal.dump"
	SECONDS=0
	dump "$dumpfile"
	counts "$OLD" >"$BACKUP_DIR/counts-$ts-rehearsal.old"

	docker rm -fv "$REHEARSAL" >/dev/null 2>&1 || true
	trap 'docker rm -fv "$REHEARSAL" >/dev/null 2>&1' EXIT
	POSTGRES_PASSWORD=$DB_PASS docker run -d --name "$REHEARSAL" -p 127.0.0.1::5432 \
		-e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD -e POSTGRES_DB="$DB_NAME" "$NEW_IMAGE" >/dev/null
	wait_ready "$REHEARSAL"
	restore "$REHEARSAL" "$dumpfile"
	log "dump + restore took ${SECONDS}s (roughly the downtime of the real cutover)"
	# The live DB keeps changing during a rehearsal, so a small difference on a busy
	# table is expected; the cutover does this check with the app stopped.
	verify_counts "$BACKUP_DIR/counts-$ts-rehearsal.old" "$REHEARSAL" ||
		echo "WARNING: row counts differ (< old, > restored); fine if only rows written during the rehearsal"

	port=$(docker port "$REHEARSAL" 5432/tcp | head -1 | sed 's/.*://')
	log "prisma against the restored database:"
	DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:$port/$DB_NAME?schema=public" npx prisma migrate status ||
		echo "WARNING: prisma migrate status reported a problem (compare with the live DB before worrying)"
	log "rehearsal OK"
}

cmd_cutover() {
	local force=0 yes=0 arg
	for arg in "$@"; do
		case $arg in
		--force) force=1 ;;
		--yes) yes=1 ;;
		*) die "unknown option $arg" ;;
		esac
	done
	preflight

	local conns ts dumpfile answer NEW
	conns=$(sql "$OLD" 'select count(*) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()')
	[ "$conns" = 0 ] || [ $force = 1 ] ||
		die "$conns open connection(s) to $DB_NAME: stop the app first (pm2 stop sveltekit), or pass --force and lose what is written during the dump"
	if [ $yes = 0 ]; then
		read -rp "Replace $OLD_NAME (PostgreSQL $OLD_MAJOR) with $NEW_IMAGE? Type 'upgrade' to continue: " answer
		[ "$answer" = upgrade ] || die "aborted"
	fi

	ts=$(date +%Y%m%d-%H%M%S)
	dumpfile="$BACKUP_DIR/$DB_NAME-pg$OLD_MAJOR-$ts.dump"
	printf 'OLD_IMAGE=%q\nOLD_VOLUME=%q\nOLD_PORT=%q\n' "$OLD_IMAGE" "$OLD_VOLUME" "$OLD_PORT" >"$STATE"
	counts "$OLD" >"$BACKUP_DIR/counts-$ts.old"
	dump "$dumpfile"

	trap 'rc=$?; [ $rc = 0 ] || echo "Cutover failed after the old container was stopped. Old data is untouched; to bring it back: $0 rollback" >&2' EXIT
	log "stopping $OLD_NAME and starting $NEW_IMAGE"
	docker stop "$OLD" >/dev/null
	docker compose up -d "$SERVICE"
	NEW=$(docker compose ps -q "$SERVICE" | head -1)
	wait_ready "$NEW"
	[ "$(sql "$NEW" "select count(*) from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')")" = 0 ] ||
		die "the new volume already contains tables; refusing to restore over them"

	restore "$NEW" "$dumpfile"
	verify_counts "$BACKUP_DIR/counts-$ts.old" "$NEW" || die "row counts differ between old (<) and new (>)"
	# Through the published port, i.e. with password auth exactly as the app connects
	PGPASSWORD=$DB_PASS docker run --rm --network host -e PGPASSWORD "$NEW_IMAGE" \
		psql -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc 'select version()'

	# A stopped rollback container from an earlier attempt only pins the old volume
	[ "$OLD_NAME" != "$ROLLBACK" ] || docker rm "$ROLLBACK" >/dev/null

	log "done. Start the app again (pm2 start sveltekit)."
	echo "    Undo: $0 rollback   (loses anything written to the new DB in the meantime)"
	echo "    Once happy, the old data can be deleted: docker volume rm $OLD_VOLUME"
}

cmd_rollback() {
	[ -f "$STATE" ] || die "$STATE not found; no cutover to roll back"
	# shellcheck disable=SC1090
	. "$STATE"
	log "stopping the new container and starting $OLD_IMAGE on $OLD_VOLUME"
	docker compose stop "$SERVICE"
	docker rm -f "$ROLLBACK" >/dev/null 2>&1 || true
	# unless-stopped, not always: once a retried cutover stops this container it must
	# stay down across reboots instead of racing the new one for the port
	docker run -d --name "$ROLLBACK" --restart unless-stopped ${OLD_PORT:+-p "$OLD_PORT:5432"} \
		-v "$OLD_VOLUME:$OLD_DATA_DIR" "$OLD_IMAGE" >/dev/null
	load_database_url
	wait_ready "$ROLLBACK"
	sql "$ROLLBACK" 'select version()'
	log "the old database is back, in container $ROLLBACK."
	echo "    Revert docker-compose.yml too, or the next 'docker compose up' starts the new version again."
	echo "    To retry the cutover:"
	echo "      docker compose rm -sf $SERVICE && docker volume rm $(compose_value name)_$(docker compose config --volumes | head -1)"
	echo "      OLD_CONTAINER=$ROLLBACK $0 cutover"
}

case ${1:-} in
preflight) preflight ;;
rehearse) cmd_rehearse ;;
cutover) shift; cmd_cutover "$@" ;;
rollback) cmd_rollback ;;
*) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
