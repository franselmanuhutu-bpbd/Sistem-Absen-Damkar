import os
import requests
from dotenv import load_dotenv

load_dotenv('backend/.env')
load_dotenv('.env')

API = 'http://127.0.0.1:8000/api'
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

def test_all():
    # 1. Root
    r = requests.get(f'{API}/')
    print('1. Root:', r.status_code, r.json())
    assert r.status_code == 200

    # 2. Login
    r = requests.post(f'{API}/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})
    print('2. Login:', r.status_code, r.json().get('user', {}).get('name'))
    assert r.status_code == 200
    token = r.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    # 3. Auth Me
    r = requests.get(f'{API}/auth/me', headers=headers)
    print('3. Me:', r.status_code, r.json().get('email'))
    assert r.status_code == 200

    # 4. Teams
    r = requests.get(f'{API}/teams', headers=headers)
    print('4. Teams:', r.status_code, f"{len(r.json())} teams")
    assert len(r.json()) == 6

    # 5. Employees
    r = requests.get(f'{API}/employees', headers=headers)
    print('5. Employees:', r.status_code, f"{len(r.json())} employees")
    assert len(r.json()) == 54

    # 6. Dashboard
    r = requests.get(f'{API}/dashboard', headers=headers)
    print('6. Dashboard:', r.status_code, 'Totals:', r.json().get('totals'))
    assert r.status_code == 200

    # 7. Recap
    r = requests.get(f'{API}/recap/monthly?month=2026-10', headers=headers)
    print('7. Recap:', r.status_code, 'Total Pegawai:', r.json().get('total_pegawai'))
    assert r.status_code == 200

    # 8. Calendar
    r = requests.get(f'{API}/calendar?month=2026-10', headers=headers)
    days_count = len(r.json().get('days', {}))
    print('8. Calendar:', r.status_code, f"{days_count} days")
    assert r.status_code == 200

    # 9. Excel Export
    r = requests.get(f'{API}/export/excel?start=2026-01&end=2026-10', headers=headers)
    print('9. Export Excel:', r.status_code, f"{len(r.content)} bytes")
    assert r.status_code == 200

    # 10. PDF Export
    r = requests.get(f'{API}/export/pdf?start=2026-01&end=2026-10', headers=headers)
    print('10. Export PDF:', r.status_code, f"{len(r.content)} bytes")
    assert r.status_code == 200

    print('\n=============================================')
    print('ALL VERIFICATION TESTS PASSED SUCCESSFULLY!')
    print('=============================================')

if __name__ == '__main__':
    test_all()
