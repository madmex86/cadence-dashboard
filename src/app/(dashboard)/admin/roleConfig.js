export const BUILTIN_ROLES = ["user", "fulfillment", "finance", "admin"];

export const ALL_PAGES = [
  { group: "PRODUCTION", pages: [
    { label: "Queue & Cost Engine", path: "/queue" },
    { label: "Live",                path: "/live" },
    { label: "Fulfillment",         path: "/fulfillment" },
    { label: "Printers",            path: "/printers" },
    { label: "Filament",            path: "/inventory" },
  ]},
  { group: "CATALOG", pages: [
    { label: "Creatures",    path: "/creatures" },
    { label: "Components",   path: "/components" },
    { label: "Lure Forge",   path: "/lure-forge" },
    { label: "Asset Studio", path: "/asset-studio" },
    { label: "Review Forge", path: "/reviews" },
    { label: "Cami Edition", path: "/cami" },
  ]},
  { group: "COMMERCE", pages: [
    { label: "Sales Intel", path: "/sales" },
    { label: "P&L",         path: "/pl" },
    { label: "Analytics",   path: "/analytics" },
    { label: "Launch",      path: "/launch" },
  ]},
  { group: "CUSTOMERS", pages: [
    { label: "Customers",   path: "/customers" },
    { label: "Email Blast", path: "/email-blast" },
  ]},
  { group: "OPS", pages: [
    { label: "Site",     path: "/site" },
    { label: "Links",    path: "/links" },
    { label: "Activity", path: "/activity" },
    { label: "Admin",    path: "/admin" },
  ]},
];

export const TOTAL_PAGES = ALL_PAGES.reduce((sum, g) => sum + g.pages.length, 0);

// Approximate default access per built-in role — used to pre-populate the custom access toggle
export const BUILTIN_DEFAULTS = {
  admin:       ALL_PAGES.flatMap(g => g.pages.map(p => p.path)),
  fulfillment: ["/queue", "/live", "/fulfillment", "/printers", "/inventory", "/creatures", "/customers"],
  finance:     ["/live", "/printers", "/inventory", "/creatures", "/components", "/sales", "/pl", "/analytics", "/customers", "/email-blast"],
  user:        ["/creatures", "/customers"],
};
