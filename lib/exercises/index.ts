import { ExerciseIntentModel } from '@/lib/exercises/exerciseIntentTypes'
import { leftArmRaiseIntent } from '@/lib/exercises/leftArmRaiseIntent'
import { rightArmRaiseIntent } from '@/lib/exercises/rightArmRaiseIntent'
import { seatedKneeLiftIntent } from '@/lib/exercises/seatedKneeLiftIntent'

export const exerciseIntentLibrary: ExerciseIntentModel[] = [
  rightArmRaiseIntent,
  leftArmRaiseIntent,
  seatedKneeLiftIntent,
]

export function getExerciseIntentById(id: string): ExerciseIntentModel | undefined {
  return exerciseIntentLibrary.find((exercise) => exercise.id === id)
}
