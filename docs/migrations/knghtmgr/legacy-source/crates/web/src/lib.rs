use wasm_bindgen::prelude::*;
use engine_core::GameState;

#[wasm_bindgen]
pub struct WebGame {
    state: GameState,
}

#[wasm_bindgen]
impl WebGame {
    #[wasm_bindgen(constructor)]
    pub fn new(name: String) -> Self {
        Self { state: GameState::new(&name) }
    }

    pub fn tick(&mut self) -> String {
        let events = self.state.tick();
        serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_string())
    }

    pub fn command(&mut self, cmd: String) -> String {
        if let Some(pid) = self.state.awaiting_input.clone() {
            let (events, _) = self.state.answer_prompt(&pid, &cmd);
            serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_string())
        } else {
            let events = self.state.handle_command(&cmd);
            serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_string())
        }
    }
}
