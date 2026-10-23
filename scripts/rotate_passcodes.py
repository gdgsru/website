old_hashes_block = """  // 1. Passcode Gate (Cryptographically Secured - SHA-256 Validated)
  const PASSCODE_HASHES = new Set([
    // Active chapter access passcodes
    'f0599cab56a951554beeaaf1ea0b7edc7dd508efafe17b787834b179dff4fecf',
    '2b385b03c62b2a5617b1bc1e5721363c89f9673fe927150190b533eb2d29c0ce',
    '5b0ba5d765eebd1e3f1b0729f806aa25d8e810eb3192b8f75c62c9c6ac12ae54',
    '9947ad4913ad5ea987c41a9ebef57c957c1dbefa308ebf74568ada62898839b6',
    '4bc866b2075725cf2e5c5d7d7468e6d8802051565c7887a8b93ca2d39c317a9a',
    // Normalized code variations
    '297c4be3d49912ae71f821af0d7fd4bfb0efceba09a74c9255fb9368c4f8cecb',
    '0f2b33d3ffd911bd2b498e8ccb6055fe66633837f83b6de4e769c60932c08b3d',
    '3094a9825bb4fd39d4bf717451244e7a796f7fa1a1b0299ff4f59cd8a78565ed',
    'f5f57855662e3b99bbe07cfa07053b8d7ec097b54a255f4da29b9ed3be088a91',
    '02b9b61602e49074558b2da04f9a01420f25242e7a0251c3a09a631f4a81d53c',
    // Legacy registry hashes
    '37137abf367e3c2ce2eecb53879a915b6c0fd5592c1e9b31cf737b3862ca5753',
    'cba94563a6f4460ecae2c388a101f3f01c902787eef9f27c731ea2315b746816',
    '3fe70aeebc3359c1c681cf43ebfcfa8e2ffbb474f80879ea93f3c11d044005b8',
    '95744ba0b57ea9ffebda6b83f8d227b61596cb98f6d78ec5845cbdb805bfa816',
    'b7fa34526279f04523e0ecf79430c5870bca578bce41be29c78d462ab9e342f0'
  ]);"""

new_hashes_block = """  // 1. Passcode Gate (Cryptographically Secured - SHA-256 Validated)
  // Default leaked codes rotated and removed. Managed dynamically via Supabase database & rotated hashes.
  const PASSCODE_HASHES = new Set([
    '46047f3afc08047826433c1a99744259fd927fab6e3c06d08cdcdf41def5ad9d',
    '6a3552cefba16875ce5f159fdbffbe904b393c05bec4d38ba51a4987c5b20bd3',
    '44bb64554641d376d2cb12dd19eddf3a699f4e2982730013fa68c366340f684a',
    'a3ff75b23580e9f91bfbc0a1eb40d803fc0eda22f1a928f9dac1c2f9ffce23c7',
    '79fbc426fc2792146c620ea2f916e1a1cd7e6aa2af398c5ca327d8179f1adec4'
  ]);

  // Load active passcodes dynamically from Supabase database
  const initDbPasscodes = () => {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      try {
        const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        sb.from('site_settings').select('value').eq('key', 'member_badge_passcodes').maybeSingle().then(res => {
          if (res?.data?.value && Array.isArray(res.data.value)) {
            res.data.value.forEach(item => {
              if (item && item.code && item.active !== false) {
                PASSCODE_HASHES.add(sha256(item.code.trim().toUpperCase()));
              }
            });
          }
        }).catch(() => {});
      } catch (_) {}
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDbPasscodes, { once: true });
  } else {
    initDbPasscodes();
  }"""

for p in ['cloudflare-pages-site/member-badge/index.html', 'deployment/website/member-badge/index.html']:
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    c_norm = c.replace('\r\n', '\n')
    old_norm = old_hashes_block.replace('\r\n', '\n')
    assert old_norm in c_norm, f"old_hashes_block not found in {p}"
    c_norm = c_norm.replace(old_norm, new_hashes_block)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(c_norm)
    print(f'Updated {p}!')
