import subprocess
import asyncio
import tempfile
import os
from storage.gcs_client import GCSClient


class AssemblyPipeline:
    def __init__(self):
        self.gcs = GCSClient()

    async def assemble(
        self,
        mission_id: str,
        scene_urls: list,
        audio_url: str,
        on_progress=None,
    ) -> str:
        """Download 3 scene clips + audio, ffmpeg-assemble with dissolve transitions."""
        with tempfile.TemporaryDirectory() as tmp:
            # Download video scenes
            paths = []
            for i, url in enumerate(scene_urls):
                p = os.path.join(tmp, f"s{i}.mp4")
                await self.gcs.download_to_file(url, p)
                paths.append(p)

            # Download audio
            apath = os.path.join(tmp, "score.wav")
            await self.gcs.download_to_file(audio_url, apath)

            out = os.path.join(tmp, "trailer.mp4")
            cmd = [
                "ffmpeg", "-y",
                "-i", paths[0],
                "-i", paths[1],
                "-i", paths[2],
                "-i", apath,
                "-filter_complex",
                (
                    "[0:v][1:v]xfade=transition=dissolve:duration=0.5:offset=7.5[v01];"
                    "[v01][2:v]xfade=transition=dissolve:duration=0.5:offset=15.0[vout]"
                ),
                "-map", "[vout]",
                "-map", "3:a",
                "-c:v", "libx264",
                "-crf", "18",
                "-preset", "fast",
                "-c:a", "aac",
                "-b:a", "320k",
                "-shortest",
                "-movflags", "+faststart",
                out,
            ]
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: subprocess.run(cmd, capture_output=True, text=True)
            )
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg assembly failed: {result.stderr}")

            if on_progress:
                on_progress("assembled")

            with open(out, "rb") as f:
                data = f.read()

        return await self.gcs.upload_bytes(
            data, f"trailers/{mission_id}/final.mp4", "video/mp4"
        )
