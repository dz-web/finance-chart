import { max, min } from 'd3-array';
import { area } from 'd3-shape';
import clamp from 'lodash.clamp';
import uniq from 'lodash.uniq';
import { formateDate } from '../algorithm/date';
import { divide } from '../algorithm/divide';
import { MovableRange } from '../algorithm/range';
import { drawLine, drawXAxis, drawYAxis } from '../paint-utils/index';
import { autoResetStyle, Chart, ChartTheme, YAxisDetail } from './chart';
import { ChartTitle } from './chart-title';
import { TimeSeriesData } from './data-structure';
import { Drawer, DrawerOptions } from './drawer';

export interface TimeSeriesTheme extends ChartTheme {
  TimeSeries: {
    price: string;
    linearGradient: string[];
    avg: string;
  };
}
export const TimeSeriesWhiteTheme = {
  price: '#4B99FB',
  linearGradient: [
    'rgba(75, 153, 251, 0.4)',
    'rgba(75, 153, 251, 0)',
  ],
  avg: '#F89D37',
};
export const TimeSeriesBlackTheme = {
  price: '#4B99FB',
  linearGradient: [
    'rgba(75, 153, 251, 0.4)',
    'rgba(75, 153, 251, 0)',
  ],
  avg: '#F89D37',
};

/**
 * 分时图绘图器
 */
export class TimeSeriesDrawer extends Drawer {
  public static precision = 2;
  public theme: TimeSeriesTheme;
  public titleDrawer: ChartTitle;
  public range: MovableRange<TimeSeriesData>;
  public canScale = false;

  private fSkip = GetSkip(this.maxValue - this.minValue);
  public topValue = ((lastTopValue = Number.MIN_VALUE) => () => {
    // if (this.maxValue > lastTopValue) {
    //   // const extra = clamp(Math.abs(this.maxValue * 0.01), 0.05, 2.5);
    //   //   console.log('this.maxValue',this.maxValue);
    //   lastTopValue = this.maxValue + this.maxValue * 0.01;
    // }
    // console.log('最大', this.maxValue, lastTopValue)
    // return lastTopValue;
    // 找最大值
    let fNearMax: number = 0;

    let fTimes: number = this.maxValue / this.fSkip;
    let iTimes = Math.floor(fTimes);
    fNearMax = iTimes * this.fSkip;

    if (fNearMax < this.maxValue) {
      fNearMax += this.fSkip;
      }

    // console.log('最大', this.maxValue, this.fSkip, fNearMax)

    return fNearMax;
  })();
  public bottomValue = ((lastBottomValue = Number.MAX_VALUE) => () => {
    // if (this.minValue < lastBottomValue) {
    //   // const extra = clamp(Math.abs(this.minValue * 0.01), 0.05, 2.5);
    //   //   console.log('this.minValue',this.minValue);
    //   lastBottomValue = this.minValue - this.minValue * 0.01;
    // }
    // console.log('最小', this.minValue, lastBottomValue)
    // return lastBottomValue;
    // 找最小值
    let fNearMin = 0;

    //
    let fTimes: number = this.minValue / this.fSkip;
    let iTimes = Math.floor(fTimes);
    fNearMin = iTimes * this.fSkip;

    // 修正浮点数的误差
    let iTmp = 0;
    while (fNearMin + this.fSkip <= this.minValue) {
      fNearMin += this.fSkip;
      iTmp++;
      if (iTmp >= 10) {
        break;
      }
    }

    // console.log('最小', this.minValue, this.fSkip, fNearMin)

    return fNearMin;
  })();
  constructor(chart: Chart, options: DrawerOptions) {
    super(chart, options);
    this.theme = Object.assign({
      TimeSeries: TimeSeriesBlackTheme,
    }, this.chart.theme);
    this.xTickFormatter = this.xTickFormatter.bind(this);
    this.context = chart.context;
    this.titleDrawer = new ChartTitle(
      this.context,
      null, [
        {
          label: '分时走势',
          color: this.theme.TimeSeries.price,
        },
        {
          label: '均线',
          color: this.theme.TimeSeries.avg,
        },
      ],
      this.theme.titleBackground,
      'white',
      this.chart.options.resolution,
    );
  }
  public count() {
    return this.tradeTime.totalMinutes();
  }
  public setRange(range: MovableRange<TimeSeriesData>) {
    const data = range.data;
    if (data.length > 0) {
      const merge = [...data.map((d) => d.price), ...data.map((d) => d.avg)];
      this.minValue = min(merge);
      this.maxValue = max(merge);
    } else {
      this.minValue = this.chart.lastPrice;
      this.maxValue = this.chart.lastPrice;
    }
    super.setRange(range);
  }
  @autoResetStyle()
  public drawFrontSight() {
    const { context: ctx, yScale, range } = this;
    const { xScale } = this.chart;
    const data = range.visible();
    const selectedIndex = this.selectedIndex;
    const x = xScale(selectedIndex);
    const size = 5 * this.chart.options.resolution;
    ctx.beginPath();
    ctx.arc(x, yScale(data[selectedIndex].price), size, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.TimeSeries.price;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, yScale(data[selectedIndex].avg), size, 0, Math.PI * 2);
    ctx.fillStyle = this.theme.TimeSeries.avg;
    ctx.fill();
  }
  public getYAxisDetail(y: number): YAxisDetail {
    const value = this.yScale.invert(y);
    return {
      left: value.toFixed(2),
      right: this.deltaInPercentage(value),
    };
  }
  public getXAxisDetail(i: number): string {
    return this.xTickFormatter(i);
  }
  protected draw() {
    super.draw();
    const { frame } = this;
    this.drawAxes();
    this.titleDrawer.draw({
      ...frame,
      height: this.titleHeight,
    });
    this.drawTimeSeries();
  }
  protected xTickFormatter(value: number, i?: number) {
    const d = new Date();
    const minute = this.tradeTime.getMinute(value);
    d.setTime(minute * 60 * 1000);
    return formateDate(d, 'HH:mm');
  }
  protected drawYAxis() {
    const lastPrice = this.chart.lastPrice;
    const tickValues = divide(this.bottomValue(), this.topValue(), Math.floor(this.chart.height / 48)).map(n => ({
        value: n,
        color: n > lastPrice ? this.theme.rise : this.theme.fall,
    }));
    // console.log(tickValues)
    drawYAxis(
      this.context,
      tickValues,
      this.frame,
      this.yScale,
      this.chart.options.resolution,
      true,
      this.theme.gridLine,
      (v: number) => v.toFixed(TimeSeriesDrawer.precision),
    );
    drawYAxis(
      this.context,
      tickValues,
      this.frame,
      this.yScale,
      this.chart.options.resolution,
      false,
      this.theme.gridLine,
      (v) => this.deltaInPercentage(v),
      'right',
    );
  }
  protected deltaInPercentage(value: number): string {
    const lastPrice = this.chart.lastPrice;
    return `${((value - lastPrice) / lastPrice * 100).toFixed(2)}%`;
  }
  protected drawXAxis() {
    const tickValues = uniq(
      divide(0, this.chart.count() - 1, 9).map(t => Math.floor(t))
    );
    drawXAxis(
      this.context,
      tickValues,
      this.chartFrame,
      this.chart.xScale,
      this.chart.options.resolution,
      true,
      this.theme.gridLine,
      this.xTickFormatter,
      this.theme.xTick,
    );
  }
  protected drawAxes() {
    this.drawXAxis();
    this.drawYAxis();
  }
  @autoResetStyle()
  protected drawTimeSeries() {
    const { frame } = this;
    const { xScale } = this.chart;
    const { context: ctx, yScale, range } = this;
    const drawArea = area<TimeSeriesData>()
      .x((d, i) => xScale(i))
      .y0((d) => yScale(d.price))
      .y1(frame.height - this.xAxisTickHeight)
      .context(ctx);
    ctx.beginPath();
    drawArea(range.visible());
    const linearGradient = ctx.createLinearGradient(0, 0, 0, frame.height);
    this.theme.TimeSeries.linearGradient.forEach((color, i) =>
      linearGradient.addColorStop(i, color));
    ctx.fillStyle = linearGradient;
    ctx.fill();
    this.drawLine('price', this.theme.TimeSeries.price);
    this.drawLine('avg', this.theme.TimeSeries.avg);
  }
  @autoResetStyle()
  protected drawLine(key: keyof TimeSeriesData, color = 'black') {
    const { yScale, context: ctx,  range } = this;
    const { xScale } = this.chart;
    drawLine(
      ctx,
      range.visible().map((item, i) => ({
        x: xScale(i),
        y: yScale(item[key]),
      })),
      color,
      1 * this.chart.options.resolution,
    );
  }
}

function GetSkip(fDif: number): number {
  let fSkip: number = 0;

  //
  if (fDif < 0.001) {
    fSkip = 0.0001;
  } else if (fDif < 0.01) {
    fSkip = 0.001;
  } else if (fDif < 0.3) {
    fSkip = 0.01;
  } else if (fDif >= 0.3 && fDif < 1.5) {
    fSkip = 0.05;
  } else if (fDif >= 1.5 && fDif < 3) {
    fSkip = 0.1;
  } else if (fDif >= 3 && fDif < 7.5) {
    fSkip = 0.25;
  } else if (fDif >= 7.5 && fDif < 15) {
    fSkip = 0.5;
  } else if (fDif >= 15 && fDif < 30) {
    fSkip = 1.0;
  } else if (fDif >= 30 && fDif < 150) {
    fSkip = 5;
  } else if (fDif >= 150 && fDif < 300) {
    fSkip = 10;
  } else if (fDif >= 300 && fDif < 1500) {
    fSkip = 50;
  } else if (fDif >= 1500 && fDif < 3000) {
    fSkip = 100;
  } else if (fDif >= 3000 && fDif < 6000) {
    fSkip = 200;
  } else if (fDif >= 6000 && fDif < 15000) {
    fSkip = 500;
  } else if (fDif > 15000 && fDif < 25000) {
    fSkip = 1000;
  } else {
    fSkip = fDif / 10.0;
  }

  return fSkip;
}
