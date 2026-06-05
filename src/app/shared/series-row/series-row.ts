import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { SerieSummary } from '../../core/models';
import { SeriesCard } from '../series-card/series-card';

@Component({
  selector: 'app-series-row',
  imports: [CommonModule, SeriesCard, LucideChevronLeft, LucideChevronRight],
  templateUrl: './series-row.html'
})
export class SeriesRow {
  readonly title = input.required<string>();
  readonly items = input<SerieSummary[]>([]);
  
  // 🌟 SOLO dejamos el viewDetails. (Eliminamos el readonly interaction)
  readonly viewDetails = output<SerieSummary>();

  @ViewChild('scroller') private readonly scroller?: ElementRef<HTMLDivElement>;

  scroll(direction: 'left' | 'right'): void {
    const element = this.scroller?.nativeElement;
    if (!element) return;
    const distance = Math.max(320, element.clientWidth * 0.82);
    element.scrollBy({ left: direction === 'right' ? distance : -distance, behavior: 'smooth' });
  }
}