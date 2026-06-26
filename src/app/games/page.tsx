import type { Metadata } from "next";
import { VoxelEscapeGame } from "./voxel-escape-game";

export const metadata: Metadata = {
  title: "ESCAPE!! | IDOL CROSSING GAMES",
  description: "イマキテランキングの楽曲をBGMに遊ぶゲーム",
};

export default function VoxelEscapePage() {
  return <VoxelEscapeGame />;
}
