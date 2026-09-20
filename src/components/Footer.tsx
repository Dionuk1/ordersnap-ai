import { useNavigate } from "react-router";
import logo from "@/assets/logo.svg";

export const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-card/50 border-t border-border mt-20 transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Column 1: Brand Info */}
        <div className="space-y-4 md:col-span-1">
          <div className="flex items-center gap-2">
            <img src={logo} alt="OrderSnap AI" className="size-7 rounded-lg" />
            <span className="font-bold text-xl tracking-tight text-foreground">
              OrderSnap <span className="text-blue-500">AI</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sistemi i menaxhimit të porosive dhe automatizimit me AI për
            Instagram, WhatsApp dhe Messenger.
          </p>
        </div>

        {/* Column 2: Platform Links */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground uppercase tracking-wider">
            Produkti
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#features" className="hover:text-foreground transition-colors">
                Veçoritë
              </a>
            </li>
            <li>
              <a href="#integrations" className="hover:text-foreground transition-colors">
                Integrimet e Postës
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                Çmimet
              </a>
            </li>
          </ul>
        </div>

        {/* Column 3: Quick Navigation */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground uppercase tracking-wider">
            Llogaria
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <button
                onClick={() => navigate("/login")}
                className="hover:text-foreground transition-colors"
              >
                Kyçuni
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate("/register")}
                className="hover:text-foreground transition-colors"
              >
                Krijo llogari
              </button>
            </li>
          </ul>
        </div>

        {/* Column 4: Support & Legal */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-foreground uppercase tracking-wider">
            Mbeshtetja
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#contact" className="hover:text-foreground transition-colors">
                Kujdesi ndaj Klientit
              </a>
            </li>
            <li>
              <a href="#terms" className="hover:text-foreground transition-colors">
                Kushtet e Përdorimit
              </a>
            </li>
            <li>
              <a href="#privacy" className="hover:text-foreground transition-colors">
                Politika e Privatësisë
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright */}
      <div className="max-w-7xl mx-auto px-6 py-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} OrderSnap AI. Të gjitha të drejtat të
          rezervuara.
        </p>
        <p className="flex items-center gap-1">
          E ndërtuar për tregtinë elektronike në Kosovë, Shqipëri &amp; Maqedoni.
        </p>
      </div>
    </footer>
  );
};
