import ctypes
import ctypes.wintypes
import subprocess
import sys

class CREDENTIAL(ctypes.Structure):
    _fields_ = [
        ('Flags', ctypes.wintypes.DWORD),
        ('Type', ctypes.wintypes.DWORD),
        ('TargetName', ctypes.c_wchar_p),
        ('Comment', ctypes.c_wchar_p),
        ('LastWritten', ctypes.wintypes.FILETIME),
        ('CredentialBlobSize', ctypes.wintypes.DWORD),
        ('CredentialBlob', ctypes.POINTER(ctypes.c_char)),
        ('Persist', ctypes.wintypes.DWORD),
        ('AttributeCount', ctypes.wintypes.DWORD),
        ('Attributes', ctypes.c_void_p),
        ('TargetAlias', ctypes.c_wchar_p),
        ('UserName', ctypes.c_wchar_p)
    ]

PCREDENTIAL = ctypes.POINTER(CREDENTIAL)
CredRead = ctypes.windll.Advapi32.CredReadW
CredRead.argtypes = [ctypes.c_wchar_p, ctypes.wintypes.DWORD, ctypes.wintypes.DWORD, ctypes.POINTER(PCREDENTIAL)]
CredRead.restype = ctypes.wintypes.BOOL

def get_github_token(target='GitHub - https://api.github.com/gdgsru'):
    pcred = PCREDENTIAL()
    if CredRead(target, 1, 0, ctypes.byref(pcred)):
        cred = pcred.contents
        token = ctypes.string_at(cred.CredentialBlob, cred.CredentialBlobSize).decode('utf-8', errors='ignore')
        user = cred.UserName or 'gdgsru'
        return user, token
    return None, None

def push(commit_message='update site'):
    user, token = get_github_token()
    if not token:
        print('Error: Could not retrieve GitHub token from Windows Credential Manager.')
        sys.exit(1)

    # 1. Add all changes
    subprocess.run(['git', 'add', '-A'], check=True)

    # 2. Check if there are changes to commit
    diff_check = subprocess.run(['git', 'diff', '--cached', '--quiet'])
    if diff_check.returncode != 0:
        subprocess.run(['git', 'commit', '-m', commit_message], check=True)
    else:
        print('No staged changes to commit.')

    # 3. Push to current branch using token
    branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode().strip()
    push_url = f'https://{user}:{token}@github.com/gdgsru/website.git'
    res = subprocess.run(['git', 'push', push_url, f'{branch}:{branch}'])
    if res.returncode == 0:
        print(f'\n[SUCCESS] Successfully pushed changes to origin/{branch}!')
    else:
        print(f'\n[ERROR] Git push failed with code {res.returncode}')
        sys.exit(res.returncode)

if __name__ == '__main__':
    msg = sys.argv[1] if len(sys.argv) > 1 else 'feat(admin): enhance workbench UX and test claim'
    push(msg)
