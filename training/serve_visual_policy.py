"""Line-oriented JSON inference server for Craftle visual policy checkpoints.

Request: {frameId,width,height,rgbBase64}; response: {frameId,action}.
Never accepts Minecraft block data or game-world objects.
"""
import argparse
import base64
import json
import sys
import numpy as np
import torch
from training.train_visual_bc import build_model, ACTIONS

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--checkpoint",required=True)
    args=p.parse_args()
    ckpt=torch.load(args.checkpoint,map_location="cpu",weights_only=True)
    actions=ckpt["actions"]
    if actions!=list(ACTIONS):raise ValueError("Checkpoint action schema mismatch")
    model=build_model(torch,len(actions))
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    print(json.dumps({"ready":True,"actions":actions}),flush=True)
    for line in sys.stdin:
        try:
            req=json.loads(line)
            if set(req)!={"frameId","width","height","rgbBase64"}:
                raise ValueError("Only RGB observation fields accepted")
            width,height=req["width"],req["height"]
            if not isinstance(width,int) or not isinstance(height,int) or not 1<=width<=1024 or not 1<=height<=1024:
                raise ValueError("Invalid image dimensions")
            raw=base64.b64decode(req["rgbBase64"],validate=True)
            if len(raw)!=width*height*3:raise ValueError("Invalid RGB24 buffer")
            image=np.frombuffer(raw,dtype=np.uint8).reshape(height,width,3).copy()
            x=torch.from_numpy(image).permute(2,0,1).unsqueeze(0).float()/255
            with torch.no_grad():scores=model(x)[0]
            action=actions[int(torch.argmax(scores).item())]
            print(json.dumps({"frameId":req["frameId"],"action":action}),flush=True)
        except Exception as e:
            print(json.dumps({"error":str(e)}),flush=True)

if __name__=="__main__":main()
