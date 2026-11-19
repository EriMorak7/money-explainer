// Type declarations for external modules without top-level imports (ambient declarations)

declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdf(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<{
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }>;
  export default pdf;
}

declare module 'recharts' {
  export const ResponsiveContainer: import('react').ComponentType<Record<string, unknown>>;
  export const BarChart: import('react').ComponentType<Record<string, unknown>>;
  export const Bar: import('react').ComponentType<Record<string, unknown>>;
  export const XAxis: import('react').ComponentType<Record<string, unknown>>;
  export const YAxis: import('react').ComponentType<Record<string, unknown>>;
  export const Tooltip: import('react').ComponentType<Record<string, unknown>>;
  export const PieChart: import('react').ComponentType<Record<string, unknown>>;
  export const Pie: import('react').ComponentType<Record<string, unknown>>;
  export const Cell: import('react').ComponentType<Record<string, unknown>>;
  export const Legend: import('react').ComponentType<Record<string, unknown>>;
  export const LineChart: import('react').ComponentType<Record<string, unknown>>;
  export const Line: import('react').ComponentType<Record<string, unknown>>;
  export const AreaChart: import('react').ComponentType<Record<string, unknown>>;
  export const Area: import('react').ComponentType<Record<string, unknown>>;
  export const CartesianGrid: import('react').ComponentType<Record<string, unknown>>;
}

declare module 'lucide-react' {
  export type IconComponent = import('react').ForwardRefExoticComponent<
    import('react').SVGProps<SVGSVGElement> & {
      size?: string | number;
      absoluteStrokeWidth?: boolean;
      color?: string;
    }
  >;
  export const LayoutDashboard: IconComponent;
  export const UploadCloud: IconComponent;
  export const Receipt: IconComponent;
  export const PieChart: IconComponent;
  export const PiggyBank: IconComponent;
  export const CreditCard: IconComponent;
  export const Target: IconComponent;
  export const Sparkles: IconComponent;
  export const MessageSquare: IconComponent;
  export const Settings: IconComponent;
  export const ShieldCheck: IconComponent;
  export const TrendingUp: IconComponent;
  export const TrendingDown: IconComponent;
  export const Clock: IconComponent;
  export const Flame: IconComponent;
  export const Building2: IconComponent;
  export const ChevronDown: IconComponent;
  export const Bell: IconComponent;
  export const HelpCircle: IconComponent;
  export const Wallet: IconComponent;
  export const Menu: IconComponent;
  export const X: IconComponent;
  export const FileText: IconComponent;
  export const CheckCircle2: IconComponent;
  export const ArrowRight: IconComponent;
  export const Lock: IconComponent;
  export const FileSpreadsheet: IconComponent;
  export const AlertCircle: IconComponent;
  export const ArrowUpRight: IconComponent;
  export const ArrowDownRight: IconComponent;
  export const Percent: IconComponent;
  export const Activity: IconComponent;
  export const Repeat: IconComponent;
  export const Calendar: IconComponent;
  export const Info: IconComponent;
  export const Search: IconComponent;
  export const Filter: IconComponent;
  export const ArrowUpDown: IconComponent;
  export const Eye: IconComponent;
  export const Check: IconComponent;
  export const Download: IconComponent;
  export const SlidersHorizontal: IconComponent;
  export const ChevronLeft: IconComponent;
  export const ChevronRight: IconComponent;
  export const Send: IconComponent;
  export const CornerDownLeft: IconComponent;
  export const RotateCcw: IconComponent;
  export const Edit2: IconComponent;
  export const Plus: IconComponent;
  export const Minus: IconComponent;
  export const AlertTriangle: IconComponent;
  export const Tag: IconComponent;
  export const Trash2: IconComponent;
  export const Upload: IconComponent;
  export const ToggleLeft: IconComponent;
  export const ToggleRight: IconComponent;
  export const Sliders: IconComponent;
  export const DollarSign: IconComponent;
}
