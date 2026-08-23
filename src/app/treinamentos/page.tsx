import type { Metadata } from "next";
import TrainingCenter from "@/components/training/TrainingCenter";

export const metadata: Metadata = { title: "Central de Treinamento · O Prestador", description: "Tutoriais e treinamentos do ERP O Prestador." };
export default function TrainingPage() { return <TrainingCenter />; }
