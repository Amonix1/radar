import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Finanční radar Litvínova',description:'Transparentní analýza hospodaření města Litvínov z oficiálních dat MONITORu Státní pokladny.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="cs" suppressHydrationWarning><body>{children}</body></html>;}
