import { describe, expect, it } from 'vitest';
import { findMentions, insertMention, mentionQuery, splitMentions } from '../mentions';

const TEAM = ['عبد الله', 'نور حسن', 'نور', 'يوسف العتيبي'];
describe('mentions', () => {
  it('finds mentioned names, longest first, once each', () => {
    expect(findMentions('@نور حسن كلمي @يوسف العتيبي و @نور حسن', TEAM)).toEqual(['نور حسن', 'يوسف العتيبي']);
    expect(findMentions('@نور و @نور حسن', TEAM)).toEqual(['نور حسن', 'نور']);
    expect(findMentions('مفيش منشن هنا', TEAM)).toEqual([]);
  });
  it('mentionQuery reads the word after @ at the caret', () => {
    expect(mentionQuery('كلم @نو', 7)).toBe('نو');
    expect(mentionQuery('email@x', 7)).toBeNull();
    expect(mentionQuery('no at sign', 5)).toBeNull();
  });
  it('insertMention completes the name and moves the caret', () => {
    const r = insertMention('كلم @يو بكرة', 7, 'يوسف العتيبي');
    expect(r.text).toBe('كلم @يوسف العتيبي  بكرة');
    expect(r.caret).toBe('كلم @يوسف العتيبي '.length);
  });
  it('splitMentions marks mention parts', () => {
    const parts = splitMentions('شوف @عبد الله لو سمحت', TEAM);
    expect(parts).toEqual([{ mention: false, v: 'شوف ' }, { mention: true, v: '@عبد الله' }, { mention: false, v: ' لو سمحت' }]);
  });
});
