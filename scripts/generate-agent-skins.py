"""Generate stable, distinct 64x64 vanilla-format skins for Craftle agents.
No external packages beyond Pillow. Cosmetic assets are NOT injected into server
gameplay, observations, or reward. Output file is PNG, identity in JSON.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import argparse, hashlib, json

PALETTES = [
 ("copper", "#be7748", "#262c3a", "#73c9b7"),
 ("violet", "#865ac2", "#28223f", "#e8bd6a"),
 ("forest", "#507a54", "#1c3028", "#cfdf8d"),
 ("cobalt", "#4776c6", "#17233c", "#f6a55a"),
 ("crimson", "#c65459", "#361c2f", "#c7daf7"),
 ("gold", "#cd9e47", "#3c3024", "#86bed4"),
 ("teal", "#42a7a0", "#14313d", "#efa6b2"),
 ("silver", "#96a3b2", "#262f43", "#f1ca72"),
 ("rose", "#c37c9b", "#322439", "#9ddcb3")
]
# Minecraft 64x64 standard skin. Rectangular face UV regions are filled with
# recognizable colors; limbs have contrasting bands to distinguish agents.
REGIONS = [
 (8,8,16,16), (0,8,8,16),(16,8,24,16),(24,8,32,16),(8,0,16,8),(16,0,24,8),
 (20,20,28,32),(16,20,20,32),(28,20,36,32),(32,20,40,32),(20,16,28,20),(28,16,36,20),
 (44,20,48,32),(40,20,44,32),(48,20,52,32),(52,20,56,32),(44,16,48,20),
 (4,20,8,32),(0,20,4,32),(8,20,12,32),(12,20,16,32),(4,16,8,20),
 (20,52,24,64),(16,52,20,64),(24,52,28,64),(28,52,32,64),(20,48,24,52),
 (36,52,40,64),(32,52,36,64),(40,52,44,64),(44,52,48,64),(36,48,40,52)]
def make_skin(agent_id,palette):
    name,primary,dark,accent=palette
    im=Image.new('RGBA',(64,64),(0,0,0,0));d=ImageDraw.Draw(im)
    for box in REGIONS:
        d.rectangle((box[0],box[1],box[2]-1,box[3]-1),fill=dark)
    for box in [(8,8,16,16),(20,20,28,32),(44,20,48,32),(4,20,8,32),
                (20,52,24,64),(36,52,40,64)]:
        d.rectangle((box[0],box[1],box[2]-1,box[3]-1),fill=primary)
    # Recognizable face, shirt logo, and asymmetric sleeve band.
    d.rectangle((10,11,11,12),fill=accent);d.rectangle((14,11,15,12),fill=accent)
    d.rectangle((22,24,25,27),fill=accent)
    d.rectangle((44,25,47,26),fill=accent)
    d.rectangle((4,28,7,29),fill=accent)
    d.rectangle((20,58,23,59),fill=accent)
    # Unique emblem bits, deterministic and reproducible without randomness.
    digest=hashlib.sha256(agent_id.encode()).digest()
    for i in range(8):
        if digest[i]&1:d.point((21+i%4,28+i//4),fill=accent)
    return im

def main():
    p=argparse.ArgumentParser();p.add_argument('--output',default='recordings/skins')
    p.add_argument('--agents',nargs='+',default=['Turesla']+[f'agent_{i:03}' for i in range(2,10)])
    args=p.parse_args()
    directory=Path(args.output);directory.mkdir(parents=True,exist_ok=True)
    identities={}
    for i,agent in enumerate(args.agents):
        if not agent.replace('_','').isalnum():raise ValueError('Invalid agent name')
        palette=PALETTES[i%len(PALETTES)]
        dest=directory/(agent+'.png')
        make_skin(agent,palette).save(dest)
        identities[agent]={'skin':str(dest),'palette':palette[0],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
                           'identityId':hashlib.sha256(('craftle:identity:v1:'+agent).encode()).hexdigest()[:16]}
    (directory/'identities.json').write_text(json.dumps({'schema':'craftle.agent-identities.v1','identities':identities},indent=2)+'\n')
    print(f'Generated {len(identities)} stable skins in {directory}')
if __name__=='__main__':main()
