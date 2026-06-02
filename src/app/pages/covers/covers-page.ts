import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowRight, LucideCheck, LucideHeart, LucideStar } from '@lucide/angular';
import { SerieSummary } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';

@Component({
  selector: 'app-covers-page',
  imports: [CommonModule, LucideArrowRight, LucideCheck, LucideHeart, LucideStar],
  templateUrl: './covers-page.html'
})
export class CoversPage implements OnInit {
  readonly covers = signal<SerieSummary[]>([]);
  readonly selectedIds = signal<number[]>([]);
  readonly saving = signal(false);
  readonly loading = signal(true);

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const series = await this.onboarding.loadSeedSeries(8);
      this.covers.set(series.filter((serie) => serie.poster).slice(0, 18));
    } finally {
      this.loading.set(false);
    }
  }

  select(serie: SerieSummary): void {
    const selected = this.isSelected(serie.id_tmdb);
    const next = selected
      ? this.selectedIds().filter((id) => id !== serie.id_tmdb)
      : [...this.selectedIds(), serie.id_tmdb];

    this.selectedIds.set(next);
  }

  isSelected(idTmdb: number): boolean {
    return this.selectedIds().includes(idTmdb);
  }

  async finish(): Promise<void> {
    this.saving.set(true);
    try {
      const selected = new Set(this.selectedIds());
      for (const serie of this.covers().filter((item) => selected.has(item.id_tmdb))) {
        await this.onboarding.recordInteraction(serie, 'LE_GUSTA');
      }

      await this.router.navigate(['/browse']);
    } finally {
      this.saving.set(false);
    }
  }
}
