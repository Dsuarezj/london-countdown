export const AURORA_LAYERS = `
  <div class="aurora aurora--one"></div>
  <div class="aurora aurora--two"></div>
  <div class="aurora aurora--three"></div>
`;

export const AURORA_TROPICS_LAYERS = `
  ${AURORA_LAYERS}
  <div class="tropics"></div>
  <div class="stars"></div>
  <div class="horizon"></div>
`;

export const auroraTropics = {
  markup: AURORA_TROPICS_LAYERS
};
