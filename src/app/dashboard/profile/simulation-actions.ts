'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getRequestContext } from '@/lib/request-context';
import {
  isNewUserSimulationEnabled,
  startNewUserSimulation,
  resetSimulationActionHelper,
  stopNewUserSimulation,
} from '@/lib/debug-simulation';

export async function startSimulationAction() {
  if (!isNewUserSimulationEnabled()) {
    throw new Error('Simulation is disabled');
  }

  const ctx = await getRequestContext();
  const realUser = ctx.realUser;
  if (!realUser) {
    throw new Error('Unauthorized');
  }

  await startNewUserSimulation(realUser.id);
  revalidatePath('/dashboard');
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function resetSimulationAction() {
  if (!isNewUserSimulationEnabled()) {
    throw new Error('Simulation is disabled');
  }

  await resetSimulationActionHelper();
  revalidatePath('/dashboard');
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function stopSimulationAction() {
  stopNewUserSimulation();
  revalidatePath('/dashboard');
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
