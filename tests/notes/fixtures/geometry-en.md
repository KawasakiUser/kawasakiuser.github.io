## Geometry and coordinate components

The metric tensor $g_{\mu\nu}$ measures spacetime intervals. A change of coordinates changes its components and leaves the underlying tensor invariant. The mixed-language notation $\mathrm{d}s^2$ is the same in the Chinese specimen.

## Kerr in Boyer–Lindquist coordinates

Use signature $(-,+,+,+)$ and units $G=c=1$. Define $\Sigma=r^2+a^2\cos^2\theta$ and $\Delta=r^2-2Mr+a^2$, with mass $M$ and spin parameter $a$.

$$
\begin{aligned}
\mathrm{d}s^2
 &= -\left(1-\frac{2Mr}{\Sigma}\right)\mathrm{d}t^2-\frac{4Mar\sin^2\theta}{\Sigma}\,\mathrm{d}t\,\mathrm{d}\phi
    +\frac{\Sigma}{\Delta}\,\mathrm{d}r^2+\Sigma\,\mathrm{d}\theta^2 \\
 &\quad+\left(r^2+a^2+\frac{2Ma^2r\sin^2\theta}{\Sigma}\right)\sin^2\theta\,\mathrm{d}\phi^2 .
\end{aligned}\tag{1}\label{eq:kerr}
$$

In equation $\eqref{eq:kerr}$ the cross-term coefficient is twice the component $g_{t\phi}$. Setting $a=0$ recovers Schwarzschild coordinates and the Schwarzschild line element.[^kerr]

### Einstein tensor

The first line defines the Einstein tensor. The second line states its vanishing covariant divergence.

$$
\begin{aligned}
G_{\mu\nu} &= R_{\mu\nu}-\frac{1}{2}R g_{\mu\nu}, \\
\nabla^{\mu}G_{\mu\nu} &= 0.
\end{aligned}\tag{2}\label{eq:einstein}
$$

Equation $\eqref{eq:einstein}$ is the contracted Bianchi identity in terms of the Einstein tensor.

## A nonrotating illustration

The plotted radial factor is $f(x)=1-1/x$ for $x=r/r_s>1$. It increases from zero at the horizon limit towards one at large radius.

![The radial factor rises from zero at x equals one to 0.8 at x equals five.](asset:radial-figure "Figure 1. Synthetic illustration of the Schwarzschild radial factor.")

```python
def lapse(x: float) -> float:
    # x = r / r_s, with x greater than one in this exterior-coordinate example.
    return 1.0 - 1.0 / x
```

Table: Table 1. Sample radial factors.

| Radius ratio | Radial factor | Location in the sample |
| --- | --- | --- |
| 1.5 | 0.333 | Inner point |
| 2.0 | 0.500 | Intermediate point |
| 4.0 | 0.750 | Outer point |


[^kerr]: Saul A. Teukolsky, [The Kerr Metric](https://arxiv.org/abs/1410.2130), Classical and Quantum Gravity 32 (2015).
