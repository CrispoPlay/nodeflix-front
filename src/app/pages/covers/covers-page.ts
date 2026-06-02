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
  readonly busyIds = signal<number[]>([]);
  readonly loading = signal(true);

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const series = await this.onboarding.loadSeedSeries(3);
      this.covers.set(series.filter((serie) => serie.poster).slice(0, 18));
      this.selectedIds.set(this.onboarding.touchedSeries());
    } finally {
      this.loading.set(false);
    }
  }

  async select(serie: SerieSummary): Promise<void> {
    if (this.busyIds().includes(serie.id_tmdb)) {
      return;
    }

    this.busyIds.set([...this.busyIds(), serie.id_tmdb]);
    try {
      await this.onboarding.recordInteraction(serie, 'LE_GUSTA');
      this.selectedIds.set(Array.from(new Set([...this.selectedIds(), serie.id_tmdb])));
    } finally {
      this.busyIds.set(this.busyIds().filter((id) => id !== serie.id_tmdb));
    }
  }

  isSelected(idTmdb: number): boolean {
    return this.selectedIds().includes(idTmdb);
  }

  async finish(): Promise<void> {
    await this.router.navigate(['/browse']);
  }
}
