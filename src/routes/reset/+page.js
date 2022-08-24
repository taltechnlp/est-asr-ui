export async function load({ params, url}) {
  const resetToken = url.searchParams.get('resetToken') || '';
  return {
    resetToken
};
}
