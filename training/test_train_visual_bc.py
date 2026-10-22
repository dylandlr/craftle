import hashlib
import json
import pathlib
import tempfile
import unittest

from training.train_visual_bc import load_records, ACTIONS

class TestRgbDataset(unittest.TestCase):
    def test_loaded_images_are_verified_and_privileged_inputs_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            (root/"frames").mkdir()
            payload=bytes([10,20,30,40,50,60])
            (root/"frames/test.rgb").write_bytes(payload)
            entry={"observationSource":"first_person_rgb","pixelFormat":"RGB24",
                   "image":"frames/test.rgb","width":2,"height":1,
                   "sha256":hashlib.sha256(payload).hexdigest(),"action":"forward","episode":"smoke"}
            (root/"decisions.jsonl").write_text(json.dumps(entry)+"\n")
            records=load_records(root)
            self.assertEqual(len(records),1)
            self.assertEqual(records[0][0].shape,(1,2,3))
            self.assertEqual(records[0][1],ACTIONS.index("forward"))
            entry["sha256"]="0"*64
            (root/"decisions.jsonl").write_text(json.dumps(entry)+"\n")
            with self.assertRaisesRegex(ValueError,"fingerprint"):load_records(root)

if __name__=="__main__":unittest.main()
