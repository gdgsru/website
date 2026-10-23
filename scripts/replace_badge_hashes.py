for path in ['cloudflare-pages-site/member-badge/index.html', 'deployment/website/member-badge/index.html']:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if 'const PASSCODE_HASHES = new Set([' in line:
            start_idx = i
        if start_idx != -1 and ']);' in line:
            end_idx = i
            break
            
    if start_idx != -1 and end_idx != -1:
        new_block = [
            '  // Default leaked codes rotated and removed. Managed dynamically via Supabase database & rotated hashes.\n',
            '  const PASSCODE_HASHES = new Set([\n',
            '    "46047f3afc08047826433c1a99744259fd927fab6e3c06d08cdcdf41def5ad9d",\n',
            '    "6a3552cefba16875ce5f159fdbffbe904b393c05bec4d38ba51a4987c5b20bd3",\n',
            '    "44bb64554641d376d2cb12dd19eddf3a699f4e2982730013fa68c366340f684a",\n',
            '    "a3ff75b23580e9f91bfbc0a1eb40d803fc0eda22f1a928f9dac1c2f9ffce23c7",\n',
            '    "79fbc426fc2792146c620ea2f916e1a1cd7e6aa2af398c5ca327d8179f1adec4"\n',
            '  ]);\n',
            '  // Load active passcodes dynamically from Supabase database\n',
            '  const initDbPasscodes = () => {\n',
            '    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {\n',
            '      try {\n',
            '        const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);\n',
            '        sb.from("site_settings").select("value").eq("key", "member_badge_passcodes").maybeSingle().then(res => {\n',
            '          if (res && res.data && res.data.value && Array.isArray(res.data.value)) {\n',
            '            res.data.value.forEach(item => {\n',
            '              if (item && item.code && item.active !== false) {\n',
            '                PASSCODE_HASHES.add(sha256(item.code.trim().toUpperCase()));\n',
            '              }\n',
            '            });\n',
            '          }\n',
            '        }).catch(() => {});\n',
            '      } catch (_) {}\n',
            '    }\n',
            '  };\n',
            '  if (document.readyState === "loading") {\n',
            '    document.addEventListener("DOMContentLoaded", initDbPasscodes, { once: true });\n',
            '  } else {\n',
            '    initDbPasscodes();\n',
            '  }\n'
        ]
        lines = lines[:start_idx] + new_block + lines[end_idx+1:]
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.writelines(lines)
        print(f'Successfully updated {path}!')
    else:
        print(f'Indices not found in {path}')
