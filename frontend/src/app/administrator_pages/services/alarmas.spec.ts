import { TestBed } from '@angular/core/testing';

import { Alarmas } from './alarmas';

describe('Alarmas', () => {
  let service: Alarmas;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Alarmas);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
