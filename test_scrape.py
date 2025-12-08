import requests
from bs4 import BeautifulSoup

def test_scrape():
    url = "https://finance.yahoo.com/quote/MSTR"
    print(f"Scraping {url}...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            print("Title:", soup.title.string)
        else:
            print("Failed to retrieve page")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_scrape()
