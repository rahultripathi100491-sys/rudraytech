import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Friendsuggation } from './friendsuggation';

describe('Friendsuggation', () => {
  let component: Friendsuggation;
  let fixture: ComponentFixture<Friendsuggation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Friendsuggation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Friendsuggation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
