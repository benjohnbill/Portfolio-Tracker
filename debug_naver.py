import requests
from bs4 import BeautifulSoup
import datetime

def test_naver_scrape(code):
    url = f"https://finance.naver.com/item/sise_day.naver?code={code}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    
    print(f"Testing Scrape for {code}...")
    
    try:
        resp = requests.get(url, headers=headers)
        print(f"Status Code: {resp.status_code}")
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        table = soup.find('table', class_='type2')
        
        if not table:
            print("Table 'type2' not found. Check HTML structure.")
            # print(soup.prettify()[:1000]) # Debug
            return

        rows = table.find_all('tr')
        found_count = 0
        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 7: continue
            
            date_txt = cols[0].text.strip()
            price_txt = cols[1].text.strip()
            
            if date_txt and price_txt:
                print(f"Date: {date_txt}, Price: {price_txt}")
                found_count += 1
                if found_count >= 5: break
                
        if found_count == 0:
            print("No valid rows found.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_naver_scrape('466020')
