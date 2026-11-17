## 几何与坐标分量

度规张量 $g_{\mu\nu}$ 决定时空间隔。坐标变化会改变张量分量，几何对象本身保持不变。中英文样例使用同一记号 $\mathrm{d}s^2$。

## Boyer–Lindquist 坐标中的 Kerr 度规

取号差 $(-,+,+,+)$ 和单位 $G=c=1$，记 $\Sigma=r^2+a^2\cos^2\theta$，$\Delta=r^2-2Mr+a^2$。其中 $M$ 是质量，$a$ 是旋转参数。

$$
\begin{aligned}
\mathrm{d}s^2
 &= -\left(1-\frac{2Mr}{\Sigma}\right)\mathrm{d}t^2-\frac{4Mar\sin^2\theta}{\Sigma}\,\mathrm{d}t\,\mathrm{d}\phi
    +\frac{\Sigma}{\Delta}\,\mathrm{d}r^2+\Sigma\,\mathrm{d}\theta^2 \\
 &\quad+\left(r^2+a^2+\frac{2Ma^2r\sin^2\theta}{\Sigma}\right)\sin^2\theta\,\mathrm{d}\phi^2 .
\end{aligned}\tag{1}\label{eq:kerr}
$$

式 $\eqref{eq:kerr}$ 的交叉项系数是分量 $g_{t\phi}$ 的两倍。令 $a=0$ 可得到 Schwarzschild 坐标下的 Schwarzschild 线元。[^kerr]

### Einstein 张量

第一行定义 Einstein 张量，第二行给出其协变散度为零。

$$
\begin{aligned}
G_{\mu\nu} &= R_{\mu\nu}-\frac{1}{2}R g_{\mu\nu}, \\
\nabla^{\mu}G_{\mu\nu} &= 0.
\end{aligned}\tag{2}\label{eq:einstein}
$$

式 $\eqref{eq:einstein}$ 是用 Einstein 张量写出的缩并 Bianchi 恒等式。

## 非旋转情形示例

图中的径向因子是 $f(x)=1-1/x$，其中 $x=r/r_s>1$。从视界外趋近视界时该因子趋于零，半径很大时趋于一。

![当 x 从 1 增至 5 时，径向因子由 0 单调增加至 0.8。](asset:radial-figure "图 1．Schwarzschild 径向因子的合成示意图。")

```python
def lapse(x: float) -> float:
    # x = r / r_s, with x greater than one in this exterior-coordinate example.
    return 1.0 - 1.0 / x
```

表：表 1．径向因子示例。

| 半径之比 | 径向因子 | 采样位置 |
| --- | --- | --- |
| 1.5 | 0.333 | 内侧采样点 |
| 2.0 | 0.500 | 中间采样点 |
| 4.0 | 0.750 | 外侧采样点 |


[^kerr]: Saul A. Teukolsky，[The Kerr Metric](https://arxiv.org/abs/1410.2130)，Classical and Quantum Gravity 32 (2015)。
