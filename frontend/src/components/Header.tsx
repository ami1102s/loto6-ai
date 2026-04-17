import { Link, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "ホーム" },
  { to: "/frequency", label: "頻度分析" },
  { to: "/patterns", label: "パターン" },
  { to: "/predict", label: "AI予想" },
  { to: "/simulation", label: "シミュレーション" },
  { to: "/draws", label: "過去結果" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="bg-indigo-700 text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="text-lg font-bold tracking-wide hover:opacity-80">
            🎱 ロト6 予想分析AI
          </Link>
          <nav className="hidden md:flex gap-1">
            {navItems.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? "bg-white text-indigo-700"
                    : "hover:bg-indigo-600"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* モバイルナビ */}
        <nav className="md:hidden flex gap-1 pb-2 overflow-x-auto">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                location.pathname === to
                  ? "bg-white text-indigo-700"
                  : "hover:bg-indigo-600"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
