import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private previousUrlSubject = new BehaviorSubject<string>('/');
  previousUrl$: Observable<string> = this.previousUrlSubject.asObservable();

  private previousUrl: string = '/';

  setPreviousUrl(url: string): void {
    this.previousUrl = url;
    this.previousUrlSubject.next(url);
  }

  getPreviousUrl(): string {
    return this.previousUrl;
  }
}
