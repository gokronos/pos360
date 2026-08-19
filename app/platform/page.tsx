import PlatformOwner from "../platform-owner";
import Link from "next/link";

export default function PlatformPage(){
  return <main className="platform-shell"><div className="platform-shell-head"><Link href="/">← Panel del negocio</Link><strong>POS360 Plataforma</strong></div><PlatformOwner/></main>;
}
