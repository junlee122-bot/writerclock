import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_ko_quotes", ROOT / "scripts" / "build_ko_quotes.py"
)
builder = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(builder)


class PreciseTimeExtractionTests(unittest.TestCase):
    def test_spaced_eleven_is_not_misread_as_one(self):
        self.assertEqual(builder.extract_precise("열 한 시가 되었다."), [])

    def test_non_time_compounds_are_rejected(self):
        for sentence in (
            "한 시어머니한테 갔다.",
            "한시(漢詩)를 읽었다.",
            "군밤을 먹었다.",
            "밤낮 일했다.",
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(builder.extract_precise(sentence), [])

    def test_multiple_or_approximate_times_are_rejected(self):
        self.assertEqual(builder.extract_precise("밤중 세 시나 네 시쯤이었다."), [])

    def test_night_cue_maps_early_hour_to_am(self):
        self.assertEqual(
            builder.extract_precise("밤 세 시였다."),
            [("03:00", "세 시", "am")],
        )

    def test_native_korean_minute_followed_by_copula_is_captured(self):
        self.assertEqual(builder.extract_precise("아홉시 이십분이었다."), [])
        self.assertEqual(
            builder.extract_precise("오전 아홉시 이십분이었다."),
            [("09:20", "아홉시 이십분", "am")],
        )

    def test_half_hour_is_captured(self):
        self.assertEqual(builder.extract_precise("일곱시 반에야 왔다."), [])
        self.assertEqual(
            builder.extract_precise("저녁 일곱시 반에야 왔다."),
            [("19:30", "일곱시 반", "pm")],
        )


if __name__ == "__main__":
    unittest.main()
