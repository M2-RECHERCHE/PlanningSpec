import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type {
    PlanningSpecAstType,
    Time,
    CardinalityPerActivity,
    AvoidParticipationOnDate
} from './generated/ast.js';
import type { PlanningSpecServices } from './planning-spec-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: PlanningSpecServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PlanningSpecValidator;

    const checks: ValidationChecks<PlanningSpecAstType> = {
        Time: validator.checkSlotsPerDay,
        CardinalityPerActivity: validator.checkCardinalityBounds,
        AvoidParticipationOnDate: validator.checkPreferenceWeight
    };

    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class PlanningSpecValidator {

    /** slotsPerDay must be > 0 */
    checkSlotsPerDay(time: Time, accept: ValidationAcceptor): void {
        if (time.slotsPerDay <= 0) {
            accept(
                'error',
                'slotsPerDay must be strictly greater than 0.',
                { node: time, property: 'slotsPerDay' }
            );
        }
    }

    /** min must be <= max */
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

    /** preference weight must be positive */
    checkPreferenceWeight(
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
}
