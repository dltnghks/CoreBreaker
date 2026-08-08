import { GameRuntime } from "../GameRuntime";
import BenchmarkSetup from "./benchmark-setup";

export default function BenchmarkPage() {
  return <>
    <BenchmarkSetup />
    <GameRuntime benchmarkMode />
  </>;
}
