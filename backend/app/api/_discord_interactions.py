import os
import json
from fastapi import APIRouter, Request, HTTPException, Response
try:
    from nacl.signing import VerifyKey
    from nacl.exceptions import BadSignatureError
except ImportError:
    VerifyKey = None

from sqlalchemy.orm import Session
from fastapi import Depends
from ..database import get_db
from ..models import WeeklySnapshot
from datetime import datetime

router = APIRouter(tags=["Discord Interactions"])

def verify_signature(request: Request, body: bytes) -> bool:
    public_key = os.getenv("DISCORD_PUBLIC_KEY")
    if not public_key or not VerifyKey:
        return False
    
    signature = request.headers.get("X-Signature-Ed25519")
    timestamp = request.headers.get("X-Signature-Timestamp")
    
    if not signature or not timestamp:
        return False
        
    verify_key = VerifyKey(bytes.fromhex(public_key))
    try:
        verify_key.verify(f"{timestamp}{body.decode('utf-8')}".encode(), bytes.fromhex(signature))
        return True
    except BadSignatureError:
        return False

@router.post("/api/discord/interactions")
async def discord_interactions(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    
    if not verify_signature(request, body):
        raise HTTPException(status_code=401, detail="Invalid request signature")
        
    payload = json.loads(body)
    interaction_type = payload.get("type")
    
    # Type 1: PING
    if interaction_type == 1:
        return {"type": 1}
        
    # Type 2: APPLICATION_COMMAND (e.g. /comment)
    if interaction_type == 2:
        # Fetch the latest snapshot
        latest = db.query(WeeklySnapshot).order_by(WeeklySnapshot.snapshot_date.desc()).first()
        snap_id = latest.id if latest else 0
        
        return {
            "type": 9,  # MODAL
            "data": {
                "title": "이번 주 코멘트 남기기",
                "custom_id": f"comment_modal_snap_{snap_id}",
                "components": [{
                    "type": 1,
                    "components": [{
                        "type": 4,  # Text Input
                        "custom_id": "comment_text",
                        "label": "이번 주 시장/포트폴리오 단상",
                        "style": 2,  # Paragraph
                        "min_length": 1,
                        "max_length": 1000,
                        "required": True
                    }]
                }]
            }
        }
        
    # Type 3: MESSAGE_COMPONENT (Button Click)
    if interaction_type == 3:
        custom_id = payload.get("data", {}).get("custom_id", "")
        return {
            "type": 9,  # MODAL
            "data": {
                "title": "이번 주 코멘트 남기기",
                "custom_id": custom_id,  # Echo the custom_id from the button
                "components": [{
                    "type": 1,
                    "components": [{
                        "type": 4,
                        "custom_id": "comment_text",
                        "label": "이번 주 시장/포트폴리오 단상",
                        "style": 2,
                        "min_length": 1,
                        "max_length": 1000,
                        "required": True
                    }]
                }]
            }
        }
        
    # Type 5: MODAL_SUBMIT
    if interaction_type == 5:
        custom_id = payload.get("data", {}).get("custom_id", "")
        
        if custom_id.startswith("comment_modal_snap_"):
            try:
                snap_id = int(custom_id.split("_")[-1])
                components = payload.get("data", {}).get("components", [])
                comment_text = ""
                
                for row in components:
                    for comp in row.get("components", []):
                        if comp.get("custom_id") == "comment_text":
                            comment_text = comp.get("value", "")
                            break
                            
                if snap_id > 0 and comment_text:
                    snapshot = db.query(WeeklySnapshot).filter(WeeklySnapshot.id == snap_id).first()
                    if snapshot:
                        # Append to existing comment with timestamp if one already exists
                        if snapshot.comment:
                            timestamp_str = datetime.now().strftime("%m/%d %H:%M")
                            snapshot.comment = f"{snapshot.comment}\n\n[{timestamp_str} 추가]\n{comment_text}"
                        else:
                            snapshot.comment = comment_text
                        db.commit()
                        
                        return {
                            "type": 4,  # ChannelMessageWithSource
                            "data": {
                                "content": f"✅ 스냅샷 #{snap_id}에 코멘트가 성공적으로 저장되었습니다!",
                                "flags": 64  # Ephemeral (only visible to the user)
                            }
                        }
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Modal parsing error: {e}")
                
        return {
            "type": 4,
            "data": {
                "content": "❌ 코멘트 저장에 실패했습니다. (스냅샷을 찾을 수 없거나 데이터 오류입니다)",
                "flags": 64
            }
        }

    return Response(status_code=400)
