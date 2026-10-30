// Match the tested local require-corp policy. Vendor registration stays scoped
// to this directory (/blog.io/ on Pages), never the whole github.io origin.
window.coi = {
  coepCredentialless: () => false,
  coepDegrade: () => false,
  quiet: true
};
