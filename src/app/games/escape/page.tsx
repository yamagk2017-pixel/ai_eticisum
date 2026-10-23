import type { Metadata } from "next";
import { VoxelEscapeGame } from "../voxel-escape-game";

export const metadata: Metadata = {
  title: "ESCAPE!! | IDOL CROSSING GAMES",
  description: "迫ってくるボールをかわし、出口を目指す3Dアクションゲーム",
};

export default function VoxelEscapePage() {
  return <VoxelEscapeGame />;
}
