import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { InteractionType, SerieSummary } from '../../core/models';
import { SeriesCard } from '../series-card/series-card';

@Component({
  selector: 'app-series-row',
  imports: [CommonModule, SeriesCard],
  templateUrl: './series-row.html'
})
export class SeriesRow {
  readonly title = input.required<string>();
  readonly items = input<SerieSummary[]>([]);
  readonly interaction = output<{ serie: SerieSummary; type: InteractionType }>();
}
