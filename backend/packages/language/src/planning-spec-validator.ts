import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type {
    PlanningSpecAstType,
    Time,
    CardinalityPerActivity,
    AvoidParticipationOnDate,
    MaxPerScope,
    PreferredResource,
    ResourceExclusivity,
    TimeWindow
} from './generated/ast.js';
import type { PlanningSpecServices } from './planning-spec-module.js';

export function registerValidationChecks(services: PlanningSpecServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PlanningSpecValidator;

    const checks: ValidationChecks<PlanningSpecAstType> = {
        Time: validator.checkSlotsPerDay,
        CardinalityPerActivity: validator.checkCardinalityBounds,
        ResourceExclusivity: validator.checkExclusiveScope,
        TimeWindow: validator.checkTimeWindowBounds,
        AvoidParticipationOnDate: validator.checkAvoidParticipationWeight,
        MaxPerScope: validator.checkMaxPerScope,
        PreferredResource: validator.checkPreferredResourceWeight
    };

    registry.register(checks, validator);
}

export class PlanningSpecValidator {

    checkSlotsPerDay(time: Time, accept: ValidationAcceptor): void {
        if (time.slotsPerDay <= 0) {
            accept(
                'error',
                'slotsPerDay must be strictly greater than 0.',
                { node: time, property: 'slotsPerDay' }
            );
        }
    }

    checkCardinalityBounds(
        constraint: CardinalityPerActivity,
        accept: ValidationAcceptor
    ): void {
        if (constraint.min > constraint.max) {
            accept(
                'error',
                'min cannot be greater than max.',
                { node: constraint }
            );
        }
    }

    checkExclusiveScope(
        constraint: ResourceExclusivity,
        accept: ValidationAcceptor
    ): void {
        if (constraint.max < 0) {
            accept(
                'error',
                'max must be greater than or equal to 0.',
                { node: constraint, property: 'max' }
            );
        }

        if (!['slot', 'day'].includes(constraint.scope.replace(/"/g, ''))) {
            accept(
                'warning',
                'scope should be either "slot" or "day" to be handled by the solver.',
                { node: constraint, property: 'scope' }
            );
        }
    }

    checkTimeWindowBounds(
        constraint: TimeWindow,
        accept: ValidationAcceptor
    ): void {
        if (constraint.minSlot <= 0) {
            accept(
                'error',
                'minSlot must be strictly greater than 0.',
                { node: constraint, property: 'minSlot' }
            );
        }

        if (constraint.maxSlot < constraint.minSlot) {
            accept(
                'error',
                'maxSlot cannot be smaller than minSlot.',
                { node: constraint, property: 'maxSlot' }
            );
        }
    }

    checkAvoidParticipationWeight(
        preference: AvoidParticipationOnDate,
        accept: ValidationAcceptor
    ): void {
        if (preference.weight <= 0) {
            accept(
                'warning',
                'Preference weight should be greater than 0.',
                { node: preference, property: 'weight' }
            );
        }
    }

    checkMaxPerScope(
        preference: MaxPerScope,
        accept: ValidationAcceptor
    ): void {
        if (preference.max <= 0) {
            accept(
                'error',
                'max must be strictly greater than 0.',
                { node: preference, property: 'max' }
            );
        }

        if (preference.weight <= 0) {
            accept(
                'warning',
                'Preference weight should be greater than 0.',
                { node: preference, property: 'weight' }
            );
        }

        if (!['slot', 'day'].includes(preference.scope.replace(/"/g, ''))) {
            accept(
                'warning',
                'scope should be either "slot" or "day" to be handled by the solver.',
                { node: preference, property: 'scope' }
            );
        }
    }

    checkPreferredResourceWeight(
        preference: PreferredResource,
        accept: ValidationAcceptor
    ): void {
        if (preference.weight <= 0) {
            accept(
                'warning',
                'Preference weight should be greater than 0.',
                { node: preference, property: 'weight' }
            );
        }
    }
}
