import { ExerciseIntentModel } from './exerciseIntentTypes'
import { leftArmRaiseIntent } from './leftArmRaiseIntent'
import { rightArmRaiseIntent } from './rightArmRaiseIntent'
import { seatedKneeLiftIntent } from './seatedKneeLiftIntent'

export const exerciseIntentLibrary: ExerciseIntentModel[] = [
  rightArmRaiseIntent,
  leftArmRaiseIntent,
  seatedKneeLiftIntent,
]

export function getExerciseIntentById(id: string): ExerciseIntentModel | undefined {
  return exerciseIntentLibrary.find((exercise) => exercise.id === id)
}
