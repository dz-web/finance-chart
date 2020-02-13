import uniq from 'lodash.uniq';
import { determineCandleColor } from '../algorithm/color';
import { formateDate } from '../algorithm/date';
import { divide } from '../algorithm/divide';
import { MovableRange } from '../algorithm/range';
import { drawXAxis } from '../paint-utils/index';
import {
  autoResetStyle,
  Chart,
  YAxisDetail,
} from './chart';
import { CandleStickData } from './data-structure';
import { Drawer, DrawerOptions } from './drawer';

export class CandleStickDrawer extends Drawer {
  public range: MovableRange<CandleStickData>;
  constructor(chart: Chart, options: DrawerOptions) {
    super(chart, options);
    this.xTickFormatter = this.xTickFormatter.bind(this);
    this.context = chart.context;
  }
  public count() {
    return this.range.visibleLength;
  }
  public topValue = () => {
    return this.maxValue // + (this.maxValue * 0.01);
  }
  public bottomValue = () => {
    return this.minValue // - (this.minValue * 0.01);
  }
  public setRange(range: MovableRange<CandleStickData>) {
    const data = range.visible();
    if (data.length > 0) {
      const keys: Array<'low'|'high'> = ['low', 'high'];
      let minV = Number.MAX_VALUE;
      let maxV = Number.MIN_VALUE;
      for (let i = 0, lenI = data.length; i < lenI; ++i) {
        keys.forEach((key) => {
          const v = data[i][key];
          if (v < minV) {
            minV = v;
          } else if (v > maxV) {
            maxV = v;
          }
        });
      }
      this.minValue = minV;
      this.maxValue = maxV;
    } else {
      this.minValue = this.chart.lastPrice;
      this.maxValue = this.chart.lastPrice;
    }
    super.setRange(range);
  }
  public getYAxisDetail(y: number): YAxisDetail {
    return {
      left: this.yScale.invert(y).toFixed(2),
    };
  }
  public getXAxisDetail(i: number): string {
    return this.xTickDetailFormatter(i, this.range.visible());
  }
  protected draw() {
    super.draw();
    this.drawAxes();
    this.drawCandles();
  }
  protected drawXAxis() {
    const tickValues = uniq(divide(0, this.count() - 1, 4)
      .map((t) => Math.floor(t)));
    drawXAxis(
      this.context,
      tickValues,
      this.chartFrame,
      this.chart.xScale,
      this.chart.options.resolution,
      true,
      this.chart.theme.gridLine,
      (v: number) => {
        return this.xTickFormatter(v, this.range.visible());
      },
      this.chart.theme.xTick,
    );
  }
  protected xTickFormatter(i: number, data: CandleStickData[]) {
    const d = data[i];
    if (d) {
      return formateDate(d.time, this.xTickFormat());
    }
    return '';
  }
  protected xTickFormat() {
    return 'yyyy/MM';
  }
  protected xTickDetailFormatter(i: number, data: CandleStickData[]) {
    const d = data[i];
    if (d) {
      return formateDate(data[i].time, this.xTickDetailFormat());
    }
    return '';
  }
  protected xTickDetailFormat() {
    return 'yyyy/MM/dd';
  }
  protected drawAxes() {
    this.drawXAxis();
  }
  @autoResetStyle()
  protected drawCandles() {
    const { xScale } = this.chart;
    const { context: ctx, yScale, range } = this;
    const { resolution } = this.chart.options;
    range.visible().forEach((d, i) => {
      const maxV = Math.max(d.close, d.open);
      const minV = Math.min(d.close, d.open);
      const y = yScale(maxV);
      const height = Math.max(
              Math.abs(yScale(d.close) - yScale(d.open)), 1 * resolution,
            );
      let width = xScale(1) - xScale(0);
      width -= width * 0.2;
      const x = xScale(i) - width / 2;
      ctx.fillStyle = determineCandleColor(d, i, range) > 0 ?
        this.chart.theme.rise : this.chart.theme.fall;
      ctx.fillRect(x, y, width, height);
      const lineWidth = 1 * resolution;
      ctx.fillRect(x + width / 2 - lineWidth / 2, yScale(d.high), lineWidth, yScale(maxV) - yScale(d.high));
      ctx.fillRect(x + width / 2 - lineWidth / 2, yScale(minV), lineWidth, yScale(d.low) - yScale(minV));
    });
  }
}
