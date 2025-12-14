import { PrismaClient } from '@prisma/client';
import { statSync, existsSync } from 'fs';

const prisma = new PrismaClient();

interface MigrationResult {
    updated: number;
    skipped: number;
    errors: string[];
}

async function migrateFileSizes(): Promise<MigrationResult> {
    const result: MigrationResult = {
        updated: 0,
        skipped: 0,
        errors: []
    };

    const files = await prisma.file.findMany({
        where: {
            fileSize: null
        },
        select: {
            id: true,
            path: true,
            filename: true
        }
    });

    console.log(`Found ${files.length} files without fileSize`);

    for (const file of files) {
        try {
            if (!existsSync(file.path)) {
                console.warn(`File not found on disk, skipping: ${file.path} (ID: ${file.id})`);
                result.skipped++;
                continue;
            }

            const stats = statSync(file.path);
            const fileSize = BigInt(stats.size);

            await prisma.file.update({
                where: { id: file.id },
                data: { fileSize }
            });

            result.updated++;
            console.log(`Updated ${file.id}: ${fileSize} bytes (${(Number(fileSize) / 1024 / 1024).toFixed(2)} MB)`);
        } catch (error) {
            const errorMsg = `Error processing file ${file.id}: ${error}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
        }
    }

    return result;
}

async function main() {
    console.log('Starting file size migration...\n');
    const result = await migrateFileSizes();
    console.log('\n=== Migration Complete ===');
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Skipped (file not on disk): ${result.skipped}`);
    console.log(`  Errors: ${result.errors.length}`);
    if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(e => console.log(`  - ${e}`));
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
