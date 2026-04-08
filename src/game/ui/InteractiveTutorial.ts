import * as Phaser from 'phaser';
import { OnboardingPhase } from '../systems/OnboardingManager';

export enum InteractiveStepType {
  INFO = 'info',
  INTERACTION = 'interaction',
  HIGHLIGHT = 'highlight',
}

export interface TutorialStepConfig {
  id: string;
  title: string;
  description: string;
  phase: OnboardingPhase;
  type: InteractiveStepType;
  position?: { x: number; y: number };
  interactionType?: string;
  targetArea?: { x: number; y: number; width: number; height: number };
}

export interface InteractiveTutorialConfig {
  steps: TutorialStepConfig[];
  onComplete?: () => void;
  onStepComplete?: (step: TutorialStepConfig) => void;
}

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 180;
const CORNER_RADIUS = 12;
const AUTO_ADVANCE_DELAY = 20000;

export class InteractiveTutorial {
  private scene: Phaser.Scene;
  private steps: TutorialStepConfig[];
  private onComplete: (() => void) | undefined;
  private onStepComplete: ((step: TutorialStepConfig) => void) | undefined;
  private currentStepIndex: number = -1;
  private visible: boolean = false;

  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Container;
  private panelGraphics: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private stepIndicator: Phaser.GameObjects.Text;
  private phaseLabel: Phaser.GameObjects.Text;
  private nextButton: Phaser.GameObjects.Text;
  private prevButton: Phaser.GameObjects.Text;
  private skipButton: Phaser.GameObjects.Text;
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private highlightTween: Phaser.Tweens.Tween | null = null;
  private autoAdvanceTimer: Phaser.Time.TimerEvent | null = null;
  private interactionZone: Phaser.GameObjects.Zone | null = null;

  constructor(scene: Phaser.Scene, config: InteractiveTutorialConfig) {
    this.scene = scene;
    this.steps = config.steps;
    this.onComplete = config.onComplete;
    this.onStepComplete = config.onStepComplete;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(1000);
    this.container.setVisible(false);

    this.background = scene.add.graphics();
    this.highlightGraphics = scene.add.graphics();
    this.highlightGraphics.setDepth(1001);

    this.panel = scene.add.container(0, 0);
    this.panelGraphics = scene.add.graphics();

    this.titleText = scene.add.text(0, 0, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: PANEL_WIDTH - 40 },
    });

    this.descriptionText = scene.add.text(0, 0, '', {
      fontSize: '15px',
      color: '#e0e0e0',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: PANEL_WIDTH - 40 },
    });

    this.stepIndicator = scene.add.text(0, 0, '', {
      fontSize: '13px',
      color: '#b0b0b0',
      fontFamily: 'Arial',
    });

    this.phaseLabel = scene.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#4ecdc4',
      fontFamily: 'Arial',
    });

    this.nextButton = scene.add.text(0, 0, '下一步 →', {
      fontSize: '14px',
      color: '#4ecdc4',
      fontFamily: 'Arial',
    });

    this.prevButton = scene.add.text(0, 0, '← 上一步', {
      fontSize: '14px',
      color: '#b0b0b0',
      fontFamily: 'Arial',
    });

    this.skipButton = scene.add.text(0, 0, '跳过教程', {
      fontSize: '14px',
      color: '#ff6b6b',
      fontFamily: 'Arial',
    });

    this.setupPanel();
    this.setupButtons();
    this.container.add([this.background, this.panel]);
  }

  private setupPanel(): void {
    this.panelGraphics.fillStyle(0x1a1a2e, 0.95);
    this.panelGraphics.lineStyle(2, 0x4a5568, 1);
    this.panelGraphics.fillRoundedRect(
      -PANEL_WIDTH / 2,
      -PANEL_HEIGHT / 2,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      CORNER_RADIUS
    );
    this.panelGraphics.strokeRoundedRect(
      -PANEL_WIDTH / 2,
      -PANEL_HEIGHT / 2,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      CORNER_RADIUS
    );

    this.panelGraphics.lineStyle(1, 0xff5833, 0.4);
    this.panelGraphics.strokeRoundedRect(
      -PANEL_WIDTH / 2 + 4,
      -PANEL_HEIGHT / 2 + 4,
      PANEL_WIDTH - 8,
      PANEL_HEIGHT - 8,
      CORNER_RADIUS - 4
    );

    this.panel.add([
      this.panelGraphics,
      this.titleText,
      this.descriptionText,
      this.stepIndicator,
      this.phaseLabel,
    ]);
  }

  private setupButtons(): void {
    this.nextButton.setInteractive();
    this.nextButton.on('pointerdown', () => this.nextStep());
    this.nextButton.on('pointerover', () => this.nextButton.setColor('#7eddd6'));
    this.nextButton.on('pointerout', () => this.nextButton.setColor('#4ecdc4'));

    this.prevButton.setInteractive();
    this.prevButton.on('pointerdown', () => this.previousStep());
    this.prevButton.on('pointerover', () => this.prevButton.setColor('#d0d0d0'));
    this.prevButton.on('pointerout', () => this.prevButton.setColor('#b0b0b0'));

    this.skipButton.setInteractive();
    this.skipButton.on('pointerdown', () => this.skip());
    this.skipButton.on('pointerover', () => this.skipButton.setColor('#ff8888'));
    this.skipButton.on('pointerout', () => this.skipButton.setColor('#ff6b6b'));

    this.panel.add([this.nextButton, this.prevButton, this.skipButton]);
  }

  show(): void {
    this.container.setVisible(true);
    this.visible = true;
    this.currentStepIndex = 0;
    this.renderCurrentStep();
  }

  hide(): void {
    this.container.setVisible(false);
    this.visible = false;
    this.cleanupTimers();
    this.clearHighlight();
    this.clearInteractionZone();
  }

  isVisible(): boolean {
    return this.visible;
  }

  nextStep(): void {
    if (this.currentStepIndex < 0) return;

    const currentStep = this.steps[this.currentStepIndex];
    if (currentStep && this.onStepComplete) {
      this.onStepComplete(currentStep);
    }

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    this.renderCurrentStep();
  }

  previousStep(): void {
    if (this.currentStepIndex <= 0) return;
    this.currentStepIndex--;
    this.renderCurrentStep();
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    this.currentStepIndex = index;
    this.renderCurrentStep();
  }

  skip(): void {
    this.hide();
    if (this.onComplete) {
      this.onComplete();
    }
  }

  completeCurrentInteraction(): void {
    const currentStep = this.steps[this.currentStepIndex];
    if (!currentStep) return;

    if (this.onStepComplete) {
      this.onStepComplete(currentStep);
    }

    this.clearInteractionZone();
    this.currentStepIndex++;

    if (this.currentStepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    this.renderCurrentStep();
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  getCurrentStep(): TutorialStepConfig | null {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) return null;
    return this.steps[this.currentStepIndex];
  }

  getTotalSteps(): number {
    return this.steps.length;
  }

  getProgress(): string {
    return `${this.currentStepIndex + 1} / ${this.steps.length}`;
  }

  private renderCurrentStep(): void {
    const step = this.steps[this.currentStepIndex];
    if (!step) return;

    this.cleanupTimers();
    this.clearHighlight();
    this.clearInteractionZone();

    const posX = step.position?.x ?? this.scene.cameras.main.width / 2;
    const posY = step.position?.y ?? 150;
    this.panel.setPosition(posX, posY);

    this.titleText.setText(step.title);
    this.titleText.setOrigin(0.5);
    this.titleText.setY(-60);

    this.descriptionText.setText(step.description);
    this.descriptionText.setOrigin(0.5);
    this.descriptionText.setY(-10);

    this.stepIndicator.setText(this.getProgress());
    this.stepIndicator.setOrigin(0.5);
    this.stepIndicator.setY(55);

    this.phaseLabel.setText(this.getPhaseLabel(step.phase));
    this.phaseLabel.setOrigin(0.5);
    this.phaseLabel.setY(-80);

    const isLastStep = this.currentStepIndex >= this.steps.length - 1;
    const isFirstStep = this.currentStepIndex === 0;

    this.nextButton.setText(isLastStep ? '完成 ✓' : '下一步 →');
    this.nextButton.setPosition(100, 70);
    this.nextButton.setAlpha(1);

    this.prevButton.setPosition(-160, 70);
    this.prevButton.setAlpha(isFirstStep ? 0.3 : 1);

    this.skipButton.setPosition(40, 70);

    if (step.type === InteractiveStepType.HIGHLIGHT || step.type === InteractiveStepType.INTERACTION) {
      this.setupHighlight(step);
    }

    if (step.type === InteractiveStepType.INTERACTION && step.targetArea) {
      this.setupInteractionZone(step);
    }

    this.autoAdvanceTimer = this.scene.time.addEvent({
      delay: AUTO_ADVANCE_DELAY,
      callback: () => this.nextStep(),
      loop: false,
    });
  }

  private getPhaseLabel(phase: OnboardingPhase): string {
    const labels: Record<OnboardingPhase, string> = {
      [OnboardingPhase.WELCOME]: '👋 欢迎',
      [OnboardingPhase.NAVIGATION]: '🧭 导航',
      [OnboardingPhase.TASKS]: '📋 任务',
      [OnboardingPhase.INTERACTION]: '🤝 互动',
      [OnboardingPhase.COMPLETE]: '🎓 完成',
    };
    return labels[phase] ?? '';
  }

  private setupHighlight(step: TutorialStepConfig): void {
    this.highlightGraphics.clear();

    if (step.targetArea) {
      const { x, y, width, height } = step.targetArea;
      this.highlightGraphics.lineStyle(3, 0xff5833, 1);
      this.highlightGraphics.strokeRect(x, y, width, height);
      this.highlightGraphics.lineStyle(2, 0xffffff, 0.5);
      this.highlightGraphics.strokeRect(x - 3, y - 3, width + 6, height + 6);
    }

    this.highlightTween = this.scene.tweens.add({
      targets: this.highlightGraphics,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setupInteractionZone(step: TutorialStepConfig): void {
    if (!step.targetArea) return;

    const { x, y, width, height } = step.targetArea;
    this.interactionZone = this.scene.add.zone(x + width / 2, y + height / 2, width, height);
    this.interactionZone.setInteractive();
    this.interactionZone.on('pointerdown', () => {
      this.completeCurrentInteraction();
    });
    (this.interactionZone as any).setAlpha(0);
  }

  private clearHighlight(): void {
    this.highlightGraphics.clear();
    if (this.highlightTween) {
      this.highlightTween.destroy();
      this.highlightTween = null;
    }
  }

  private clearInteractionZone(): void {
    if (this.interactionZone) {
      this.interactionZone.destroy();
      this.interactionZone = null;
    }
  }

  private cleanupTimers(): void {
    if (this.autoAdvanceTimer) {
      this.autoAdvanceTimer.remove();
      this.autoAdvanceTimer = null;
    }
  }

  private complete(): void {
    this.hide();
    if (this.onComplete) {
      this.onComplete();
    }
  }

  destroy(): void {
    this.hide();
    this.container.destroy();
    this.highlightGraphics.destroy();
    this.nextButton.destroy();
    this.prevButton.destroy();
    this.skipButton.destroy();
  }
}
