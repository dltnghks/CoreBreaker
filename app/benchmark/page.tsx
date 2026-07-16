import { GameRuntime } from "../page";
import BalanceSimulator from "../skill-lab/balance-simulator";
import SkillBench from "../skill-lab/skill-bench";
import BenchmarkSetup from "./benchmark-setup";

export default function BenchmarkPage() {
  return <>
    <BenchmarkSetup />
    <BalanceSimulator />
    <SkillBench />
    <GameRuntime benchmarkMode />
  </>;
}
