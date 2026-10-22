"""PyTorch baseline for RGB-to-discrete-action behavior cloning.

This trains only on labeled visual trajectories. The current brightness-probe
recordings are *pipeline diagnostics*, not expert demonstrations.
"""
import argparse
import hashlib
import json
import pathlib
import random
import numpy as np

ACTIONS=("idle","forward","back","left","right","jump","look_left","look_right")

def load_records(root):
    root=pathlib.Path(root)
    rows=[]
    for line in (root/"decisions.jsonl").read_text().splitlines():
        if not line.strip():continue
        r=json.loads(line)
        if r.get("observationSource")!="first_person_rgb" or r.get("pixelFormat")!="RGB24":
            raise ValueError("Only first-person RGB24 examples are allowed")
        if r["action"] not in ACTIONS:raise ValueError("Unknown action")
        width,height=int(r["width"]),int(r["height"])
        if width<1 or height<1 or width>1024 or height>1024:raise ValueError("Bad shape")
        frame_path=(root/r["image"]).resolve()
        if not frame_path.is_relative_to(root.resolve()):raise ValueError("Unsafe frame path")
        raw=frame_path.read_bytes()
        if len(raw)!=width*height*3:raise ValueError("RGB24 byte length mismatch")
        if hashlib.sha256(raw).hexdigest()!=r["sha256"]:raise ValueError("Frame fingerprint mismatch")
        rows.append((np.frombuffer(raw,dtype=np.uint8).reshape(height,width,3).copy(),ACTIONS.index(r["action"]),r.get("episode","unknown")))
    if not rows:raise ValueError("No examples")
    if len({im.shape for im,_,_ in rows})!=1:raise ValueError("Mixed frame sizes not supported")
    return rows

def build_model(torch,classes):
    nn=torch.nn
    return nn.Sequential(
        nn.Conv2d(3,16,5,stride=2,padding=2),nn.ReLU(),
        nn.Conv2d(16,32,3,stride=2,padding=1),nn.ReLU(),
        nn.Conv2d(32,64,3,stride=2,padding=1),nn.ReLU(),
        nn.AdaptiveAvgPool2d((4,4)),nn.Flatten(),
        nn.Linear(64*4*4,128),nn.ReLU(),nn.Linear(128,classes))

def train(args):
    import torch
    torch.manual_seed(args.seed);random.seed(args.seed);np.random.seed(args.seed)
    rows=load_records(args.dataset)
    # This baseline trains on the full dataset; evaluation MUST use separate
    # held-out episodes/world seeds. No in-sample accuracy is reported as evaluation.
    model=build_model(torch,len(ACTIONS))
    opt=torch.optim.AdamW(model.parameters(),lr=args.lr)
    for epoch in range(args.epochs):
        order=np.random.permutation(len(rows));loss_total=0.0
        model.train()
        for start in range(0,len(order),args.batch_size):
            subset=[rows[i] for i in order[start:start+args.batch_size]]
            x=torch.from_numpy(np.stack([im for im,_,_ in subset])).permute(0,3,1,2).float()/255
            y=torch.tensor([label for _,label,_ in subset],dtype=torch.long)
            opt.zero_grad();loss=torch.nn.functional.cross_entropy(model(x),y)
            loss.backward();opt.step();loss_total+=loss.item()*len(subset)
        print(json.dumps({"epoch":epoch+1,"train_loss":round(loss_total/len(rows),5),"samples":len(rows)}))
    output=pathlib.Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    torch.save({"state_dict":model.state_dict(),"actions":list(ACTIONS),"input_size":list(rows[0][0].shape),
                "training_examples":len(rows),"dataset_type":"behavior_cloning",
                "warning":"No demonstration quality or held-out task performance established"},output)
    print(json.dumps({"checkpoint":str(output),"examples":len(rows),"validated_on_minecraft":False}))

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--dataset",required=True)
    p.add_argument("--output",default="checkpoints/craftle-bc.pt")
    p.add_argument("--epochs",type=int,default=5)
    p.add_argument("--batch-size",type=int,default=32)
    p.add_argument("--lr",type=float,default=0.001)
    p.add_argument("--seed",type=int,default=42)
    a=p.parse_args()
    if a.epochs<1 or a.batch_size<1 or a.lr<=0:p.error("Invalid training parameters")
    train(a)
