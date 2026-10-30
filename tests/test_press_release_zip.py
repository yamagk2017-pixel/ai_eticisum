import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("extract_zip", Path(__file__).parents[1] / "scripts/extract-press-release-zip.py")
extract_zip = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract_zip)


class ZipTests(unittest.TestCase):
    def test_materials_and_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "materials.zip"
            with zipfile.ZipFile(archive, "w") as z:
                z.writestr("materials/source.md", "原稿")
                z.writestr("materials/photo.jpg", b"test")
            self.assertEqual(extract_zip.extract(archive, root / "out"), ["materials/photo.jpg", "materials/source.md"])
            self.assertEqual((root / "out/materials/source.md").read_text(), "原稿")
            with self.assertRaises(ValueError):
                extract_zip.extract(archive, root / "out")
            for unsafe in ["../escape.txt", "/absolute.txt", "nested/../../escape.txt", "..\\escape.txt", "C:/escape.txt"]:
                with zipfile.ZipFile(archive, "w") as z:
                    z.writestr(unsafe, "bad")
                with self.assertRaises(ValueError):
                    extract_zip.extract(archive, root / "bad")
                self.assertFalse((root / "bad").exists())

    def test_symlink_and_partial_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "materials.zip"
            info = zipfile.ZipInfo("link")
            info.external_attr = 0o120777 << 16
            with zipfile.ZipFile(archive, "w") as z:
                z.writestr(info, "../target")
            with self.assertRaises(ValueError):
                extract_zip.extract(archive, root / "out")
            self.assertFalse((root / "out").exists())


if __name__ == "__main__":
    unittest.main()
