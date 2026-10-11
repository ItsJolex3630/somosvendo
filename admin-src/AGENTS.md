<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Keep all five VENDO views as separate TanStack leaf routes within the root VendoShell so navigation and page metadata remain independent.
- Use the root VendoProvider for session-only mock clients, transactions, and settings so cross-view edits share a single state without implying durable storage.
- Keep reusable finance presentation in src/components/vendo and browser-safe data helpers in src/lib/vendo so leaf routes stay small.
- Render Recharts after hydration with stable chart containers so SSR and initial browser markup stay consistent.
- Express the VENDO palette and typography through src/styles.css semantic tokens so all views share the brand.
