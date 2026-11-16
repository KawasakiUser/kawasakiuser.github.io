import katex from 'katex';

export type MathRenderer = (tex: string, display: boolean) => string;

const commands = new Set((
  'frac dfrac tfrac sqrt left right middle begin end big Big bigg Bigg ' +
  'bigl bigr Bigl Bigr biggl biggr Biggl Biggr quad qquad cdot times pm mp ' +
  'sum prod int oint lim sin cos tan exp log ln det partial nabla infty ' +
  'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi rho sigma tau phi varphi chi psi omega ' +
  'Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega ' +
  'mathrm mathbf mathcal mathbb mathit mathsf mathtt operatorname text overline underline hat widehat bar vec dot ddot ' +
  'le leq ge geq neq approx sim equiv propto to mapsto rightarrow leftarrow leftrightarrow Rightarrow Leftrightarrow ' +
  'in notin subset subseteq cup cap forall exists ell ldots cdots vdots ddots langle rangle lvert rvert langle rangle ' +
  'lbrace rbrace vert Vert space colon'
).split(' '));
const environments = new Set(['aligned', 'gathered', 'split', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'cases']);

export function assertScienceTex(tex: string): void {
  if (!tex.trim() || tex.length > 8192 || tex.includes('%') || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(tex)) {
    throw new Error('TEX_INPUT: empty, oversized, commented or control-character input');
  }
  for (const [, command = ''] of tex.matchAll(/\\([A-Za-z]+|[^A-Za-z])/g)) {
    if (!commands.has(command) && !['\\', ',', ';', ':', '!', ' ', '{', '}', '|', '_', '#', '$', '&'].includes(command)) {
      throw new Error('TEX_COMMAND: ' + command);
    }
  }
  if (tex.endsWith('\\') && !tex.endsWith('\\\\')) throw new Error('TEX_INPUT: incomplete command');
  for (const match of tex.matchAll(/\\(?:begin|end)\s*(?:\{([^}]+)\})?/g)) {
    if (!match[1] || !environments.has(match[1])) throw new Error('TEX_ENVIRONMENT: ' + (match[1] ?? 'missing'));
  }
}

export const renderKatex: MathRenderer = (tex, display) => katex.renderToString(tex, {
  displayMode: display,
  output: 'mathml',
  throwOnError: true,
  strict: 'error',
  trust: false,
  maxSize: 10,
  maxExpand: 300
});
