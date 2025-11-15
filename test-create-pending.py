"""
Simple Flask server to test the create-pending bot function locally.
Run this while your Next.js app is running on localhost:3000
"""

from flask import Flask, jsonify
import requests
import os
from datetime import datetime

app = Flask(__name__)

# Configuration
NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000")
CRON_SECRET = os.getenv("CRON_SECRET", "")  # Optional: set if you have CRON_SECRET in your .env

@app.route("/")
def home():
    return """
    <h1>Create Pending Bots Test Server</h1>
    <p>Endpoints:</p>
    <ul>
        <li><a href="/test">/test</a> - Test create-pending endpoint</li>
        <li><a href="/test-raw">/test-raw</a> - Test with raw response</li>
    </ul>
    """

@app.route("/test")
def test_create_pending():
    """Test the create-pending endpoint"""
    try:
        url = f"{NEXTJS_API_URL}/api/recall/create-pending"
        headers = {}
        
        # Add auth header if CRON_SECRET is set
        if CRON_SECRET:
            headers["Authorization"] = f"Bearer {CRON_SECRET}"
        
        print(f"[{datetime.now()}] Calling: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        
        result = {
            "status_code": response.status_code,
            "success": response.status_code == 200,
            "response": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
            "timestamp": datetime.now().isoformat(),
        }
        
        return jsonify(result)
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Connection failed",
            "message": f"Could not connect to {NEXTJS_API_URL}. Make sure your Next.js app is running on localhost:3000",
            "timestamp": datetime.now().isoformat(),
        }), 500
    except Exception as e:
        return jsonify({
            "error": str(type(e).__name__),
            "message": str(e),
            "timestamp": datetime.now().isoformat(),
        }), 500

@app.route("/test-raw")
def test_create_pending_raw():
    """Test the create-pending endpoint and return raw response"""
    try:
        url = f"{NEXTJS_API_URL}/api/recall/create-pending"
        headers = {}
        
        if CRON_SECRET:
            headers["Authorization"] = f"Bearer {CRON_SECRET}"
        
        print(f"[{datetime.now()}] Calling: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        
        return f"""
        <h2>Raw Response</h2>
        <p><strong>Status Code:</strong> {response.status_code}</p>
        <p><strong>Headers:</strong></p>
        <pre>{dict(response.headers)}</pre>
        <p><strong>Body:</strong></p>
        <pre>{response.text}</pre>
        <p><a href="/">Back</a></p>
        """
    except Exception as e:
        return f"""
        <h2>Error</h2>
        <p><strong>Error:</strong> {str(e)}</p>
        <p><a href="/">Back</a></p>
        """, 500

if __name__ == "__main__":
    print("=" * 60)
    print("Create Pending Bots Test Server")
    print("=" * 60)
    print(f"Next.js API URL: {NEXTJS_API_URL}")
    print(f"CRON_SECRET: {'Set' if CRON_SECRET else 'Not set (optional)'}")
    print("=" * 60)
    print("\nMake sure your Next.js app is running on localhost:3000")
    print("Then visit: http://localhost:5000/test\n")
    print("=" * 60)
    
    app.run(debug=True, port=5000)

