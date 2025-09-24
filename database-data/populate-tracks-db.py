#!/usr/bin/env python3
"""
Populate tracks table from garage61-all-tracks.json
"""

import json
import os
import psycopg2
from urllib.parse import urlparse

def get_db_connection():
    """Get database connection from environment variable"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        print("Set it like: $env:DATABASE_URL='postgresql://user:pass@host:port/db'")
        return None
    
    try:
        # Parse the database URL
        parsed = urlparse(database_url)
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port,
            database=parsed.path[1:],  # Remove leading slash
            user=parsed.username,
            password=parsed.password,
            sslmode='require' if 'sslmode=require' in database_url else 'prefer'
        )
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def populate_tracks():
    """Read JSON file and populate tracks table"""
    
    # Read the JSON file
    json_file = 'database-data/garage61-all-tracks.json'
    if not os.path.exists(json_file):
        print(f"❌ File not found: {json_file}")
        return False
    
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            tracks_data = json.load(f)
        print(f"📁 Loaded {len(tracks_data)} tracks from JSON")
    except Exception as e:
        print(f"❌ Failed to read JSON: {e}")
        return False
    
    # Connect to database
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Insert each track
        inserted = 0
        for track in tracks_data:
            try:
                cursor.execute(
                    """INSERT INTO tracks (id, name, variant, platform_id) 
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (id) DO UPDATE SET
                           name = EXCLUDED.name,
                           variant = EXCLUDED.variant,
                           platform_id = EXCLUDED.platform_id""",
                    (track['id'], track['name'], track.get('variant'), track.get('platform_id'))
                )
                inserted += 1
            except Exception as e:
                print(f"❌ Failed to insert track {track.get('id', 'unknown')}: {e}")
        
        # Commit changes
        conn.commit()
        print(f"✅ Successfully inserted/updated {inserted} tracks")
        
        # Verify count
        cursor.execute("SELECT COUNT(*) FROM tracks")
        count = cursor.fetchone()[0]
        print(f"📊 Total tracks in database: {count}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database operation failed: {e}")
        conn.rollback()
        conn.close()
        return False

if __name__ == "__main__":
    print("🚀 Starting tracks database population...")
    success = populate_tracks()
    if success:
        print("🎉 Tracks database population completed successfully!")
    else:
        print("💥 Tracks database population failed!")
        exit(1)