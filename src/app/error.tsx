'use client';
export default function Error({reset}:{reset:()=>void}){return <main className="startup"><h1>Načtení se nezdařilo</h1><p>Zkontrolujte dostupnost databáze a opakujte načtení.</p><button onClick={reset}>Načíst znovu</button></main>;}
